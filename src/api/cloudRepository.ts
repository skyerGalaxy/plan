import { createClient } from '@supabase/supabase-js';
import type {
  NewPomodoroRecord,
  NewTask,
  PomodoroRecord,
  PomodoroRecordFilter,
  PomoSchedule,
  Task,
  TaskFilter,
  TaskRepository,
} from './types';
import { normalizePomodoroRecord, normalizePomoSchedule, normalizeTask, newId } from './helpers';
import dayjs from 'dayjs';

/**
 * 云端 Supabase 仓库：与本地 SQLite 同构的三张表（tasks / pomodoro_records / app_settings）。
 * 主键使用 UUID（应用层生成），与本地保持一致的 id，避免两端主键冲突。
 * 需要在 Supabase 中先执行以下建表 SQL（启用 pgcrypto 扩展以支持 gen_random_uuid 兜底）：
 *
 * create extension if not exists "pgcrypto";
 * create table if not exists tasks (
 *   id uuid primary key default gen_random_uuid(),
 *   quarter_id uuid references tasks(id),
 *   month_id uuid references tasks(id),
 *   week_id uuid references tasks(id),
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
 * create table if not exists user_pomo_schedule (
 *   id uuid primary key default gen_random_uuid(),
 *   start_date date not null,
 *   end_date date,
 *   pomodoro_work_minutes int not null,
 *   daily_pomo_count int not null,
 *   created_at timestamptz not null default now()
 * );
 * create index if not exists idx_user_pomo_schedule_start_end
 *   on user_pomo_schedule(start_date, end_date);
 */

const supabase = createClient(
  import.meta.env.VITE_supabaseProjectUrl,
  import.meta.env.VITE_anonKey
);

/**
 * 根据全部任务的 id/三列祖先 id，收集某任务的完整子孙集合（含自身）。
 * 采用 visited 去重 + 队列逐项 push，避免数组过大造成展开参数溢出或循环引用导致无限增长。
 */
function collectSubtreeIds(
  rows: {
    id: string;
    quarter_id: string | null;
    month_id: string | null;
    week_id: string | null;
  }[],
  rootId: string
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    for (const anc of [row.quarter_id, row.month_id, row.week_id]) {
      if (anc != null) {
        const list = childrenOf.get(anc);
        if (list) list.push(row.id);
        else childrenOf.set(anc, [row.id]);
      }
    }
  }
  const ids: string[] = [rootId];
  const visited = new Set<string>([rootId]);
  for (let i = 0; i < ids.length; i++) {
    const children = childrenOf.get(ids[i]);
    if (!children) continue;
    for (const cid of children) {
      if (visited.has(cid)) continue;
      visited.add(cid);
      ids.push(cid);
    }
  }
  return ids;
}

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
    // 三个上级 id 由调用方（UI）直接传入，缺失则为 null
    const insert = {
      ...input,
      // 应用层生成 UUID，保证云端与本地主键一致
      id: input.id ?? newId(),
    };
    const { data, error } = await supabase.from('tasks').insert(insert).select().single();
    if (error) throw error;
    return normalizeTask(data);
  },

  async updateTask(id: string, patch: Partial<NewTask>): Promise<Task> {
    // patch 直接包含三个上级 id（调用方在改父任务时会一并传入），缺失则不更新
    const update: Record<string, any> = {
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return normalizeTask(data);
  },

  async deleteTask(id: string): Promise<{ deleted: string[]; blocked: string[] }> {
    const now = new Date().toISOString();
    // 取全部存活任务的 id/三列祖先 id，在客户端算出全部子孙后，仅删除其中未执行的任务
    const { data, error } = await supabase
      .from('tasks')
      .select('id, quarter_id, month_id, week_id')
      .is('deleted_at', null);
    if (error) throw error;
    const subtreeIds = collectSubtreeIds(data ?? [], id);
    const counts = await cloudRepository.countPomodoroRecords(subtreeIds);
    const blocked = subtreeIds.filter(tid => (counts[tid] ?? 0) > 0);
    const deletable = subtreeIds.filter(tid => !(counts[tid] ?? 0));

    if (deletable.length) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ deleted_at: now, updated_at: now })
        .in('id', deletable);
      if (updateError) throw updateError;
    }
    return { deleted: deletable, blocked };
  },

  async getTaskSubtreeIds(id: string): Promise<string[]> {
    // 取全部存活任务的 id/三列祖先 id，客户端算出全部子孙（含自身）
    const { data, error } = await supabase
      .from('tasks')
      .select('id, quarter_id, month_id, week_id')
      .is('deleted_at', null);
    if (error) throw error;
    return collectSubtreeIds(data ?? [], id);
  },

  async countPomodoroRecords(taskIds: string[]): Promise<Record<string, number>> {
    if (!taskIds.length) return {};
    const { data, error } = await supabase
      .from('pomodoro_records')
      .select('task_id')
      .in('task_id', taskIds);
    if (error) throw error;
    const result: Record<string, number> = {};
    for (const row of data ?? []) {
      result[row.task_id] = (result[row.task_id] ?? 0) + 1;
    }
    return result;
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

  // ---- user_pomo_schedule ----
  async getActivePomoSchedule(): Promise<PomoSchedule | null> {
    const { data, error } = await supabase
      .from('user_pomo_schedule')
      .select('*')
      .is('end_date', null)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? normalizePomoSchedule(data) : null;
  },

  async savePomoSchedule(input: {
    pomodoro_work_minutes: number;
    daily_pomo_count: number;
  }): Promise<PomoSchedule> {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    // 关闭当前生效段（end_date 置为昨日）
    const { error: closeError } = await supabase
      .from('user_pomo_schedule')
      .update({ end_date: yesterday })
      .is('end_date', null);
    if (closeError) throw closeError;
    // 新增从今天起生效的新段
    const insert = {
      id: newId(),
      start_date: today,
      end_date: null,
      pomodoro_work_minutes: input.pomodoro_work_minutes,
      daily_pomo_count: input.daily_pomo_count,
    };
    const { data, error } = await supabase
      .from('user_pomo_schedule')
      .insert(insert)
      .select()
      .single();
    if (error) throw error;
    return normalizePomoSchedule(data);
  },
};
