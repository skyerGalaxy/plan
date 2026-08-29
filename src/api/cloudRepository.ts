import { createClient } from '@supabase/supabase-js';
import type {
  NewPomodoroRecord,
  NewTask,
  PomodoroRecord,
  PomodoroRecordFilter,
  Task,
  TaskFilter,
  TaskRepository,
} from './types';
import { normalizePomodoroRecord, normalizeTask, newId } from './helpers';

/**
 * 云端 Supabase 仓库：与本地 SQLite 同构的三张表（tasks / pomodoro_records / app_settings）。
 * 主键使用 UUID（应用层生成），与本地保持一致的 id，避免两端主键冲突。
 * 需要在 Supabase 中先执行以下建表 SQL（启用 pgcrypto 扩展以支持 gen_random_uuid 兜底）：
 *
 * create extension if not exists "pgcrypto";
 * create table if not exists tasks (
 *   id uuid primary key default gen_random_uuid(),
 *   parent_id uuid references tasks(id),
 *   title text not null,
 *   description text default '',
 *   period_type int not null,
 *   total_pomodoro_quota int not null default 0,
 *   start_date date not null,
 *   end_date date not null,
 *   is_cyclic int not null default 0,
 *   cycle_rule text,
 *   sort_order int not null default 0,
 *   status text not null default 'pending',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now(),
 *   deleted_at timestamptz
 * );
 * create table if not exists pomodoro_records (
 *   id uuid primary key default gen_random_uuid(),
 *   task_id uuid not null references tasks(id),
 *   record_date date not null,
 *   start_time timestamptz not null,
 *   end_time timestamptz,
 *   duration_minutes int not null,
 *   status text not null default 'completed',
 *   created_at timestamptz not null default now()
 * );
 * create table if not exists app_settings (
 *   key text primary key,
 *   value text not null,
 *   updated_at timestamptz not null default now()
 * );
 */

const supabase = createClient(
  import.meta.env.VITE_supabaseProjectUrl,
  import.meta.env.VITE_anonKey
);

export const cloudRepository: TaskRepository = {
  async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
    let query = supabase.from('tasks').select('*');
    if (!filter.includeDeleted) {
      query = query.is('deleted_at', null);
    }
    if (filter.periodType) {
      query = query.eq('period_type', filter.periodType);
    }
    if (filter.isCyclic !== undefined) {
      query = query.eq('is_cyclic', filter.isCyclic);
    }
    if (filter.parentId !== undefined) {
      query =
        filter.parentId === null
          ? query.is('parent_id', null)
          : query.eq('parent_id', filter.parentId);
    }
    if (filter.overlapStart) {
      query = query.gte('end_date', filter.overlapStart);
    }
    if (filter.overlapEnd) {
      query = query.lte('start_date', filter.overlapEnd);
    }
    const { data, error } = await query.order('sort_order').order('id');
    if (error) throw error;
    return (data ?? []).map(normalizeTask);
  },

  async getTask(id: string): Promise<Task | null> {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeTask(data) : null;
  },

  async createTask(input: NewTask): Promise<Task> {
    // 应用层生成 UUID，保证云端与本地主键一致
    const insert = { ...input, id: input.id ?? newId() };
    const { data, error } = await supabase.from('tasks').insert(insert).select().single();
    if (error) throw error;
    return normalizeTask(data);
  },

  async updateTask(id: string, patch: Partial<NewTask>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return normalizeTask(data);
  },

  async deleteTask(id: string): Promise<void> {
    const now = new Date().toISOString();
    // 取全部存活任务的 id/parent_id，在客户端算出全部子孙任务后一并软删除
    const { data, error } = await supabase
      .from('tasks')
      .select('id, parent_id')
      .is('deleted_at', null);
    if (error) throw error;
    const rows = data ?? [];
    const childrenOf = new Map<string, string[]>();
    for (const row of rows) {
      if (row.parent_id != null) {
        const list = childrenOf.get(row.parent_id) ?? [];
        list.push(row.id);
        childrenOf.set(row.parent_id, list);
      }
    }
    const ids: string[] = [id];
    for (let i = 0; i < ids.length; i++) {
      ids.push(...(childrenOf.get(ids[i]) ?? []));
    }
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ deleted_at: now, updated_at: now })
      .in('id', ids);
    if (updateError) throw updateError;
  },

  async listPomodoroRecords(filter: PomodoroRecordFilter = {}): Promise<PomodoroRecord[]> {
    let query = supabase.from('pomodoro_records').select('*');
    if (filter.taskId !== undefined) {
      query = query.eq('task_id', filter.taskId);
    }
    if (filter.recordDate) {
      query = query.eq('record_date', filter.recordDate);
    }
    if (filter.startDate) {
      query = query.gte('record_date', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('record_date', filter.endDate);
    }
    const { data, error } = await query.order('id');
    if (error) throw error;
    return (data ?? []).map(row => normalizePomodoroRecord(row) as PomodoroRecord);
  },

  async createPomodoroRecord(input: NewPomodoroRecord): Promise<PomodoroRecord> {
    const insert = { ...input, id: input.id ?? newId() };
    const { data, error } = await supabase
      .from('pomodoro_records')
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    return normalizePomodoroRecord(data) as PomodoroRecord;
  },

  async countCompletedPomodoros(taskIds: string[]): Promise<Record<string, number>> {
    if (!taskIds.length) return {};
    const { data, error } = await supabase
      .from('pomodoro_records')
      .select('task_id')
      .eq('status', 'completed')
      .in('task_id', taskIds);
    if (error) throw error;
    const result: Record<string, number> = {};
    for (const row of data ?? []) {
      result[row.task_id] = (result[row.task_id] ?? 0) + 1;
    }
    return result;
  },

  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  },

  async setSetting(key: string, value: string): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
  },
};
