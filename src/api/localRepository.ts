import Database from '@tauri-apps/plugin-sql';
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

/** tasks 表可更新的列白名单（防止动态拼 SQL 注入） */
const TASK_COLUMNS = new Set([
  'quarter_id',
  'month_id',
  'week_id',
  'title',
  'description',
  'period_type',
  'total_pomodoro_quota',
  'pomodoro_per_occurrence',
  'start_date',
  'end_date',
  'is_cyclic',
  'cycle_rule',
  'sort_order',
  'status',
]);

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load('sqlite:plan.db');
  }
  return dbPromise;
}

/** 追加参数并返回占位符 $n */
function ph(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

export const localRepository: TaskRepository = {
  async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
    const db = await getDb();
    const sql: string[] = ['SELECT * FROM tasks'];
    const params: unknown[] = [];

    const where: string[] = [];
    if (!filter.includeDeleted) {
      where.push('deleted_at IS NULL');
    }
    if (filter.periodType) {
      where.push(`period_type = ${ph(params, filter.periodType)}`);
    }
    if (filter.isCyclic !== undefined) {
      where.push(`is_cyclic = ${ph(params, filter.isCyclic)}`);
    }
    if (filter.overlapStart) {
      where.push(`end_date >= ${ph(params, filter.overlapStart)}`);
    }
    if (filter.overlapEnd) {
      where.push(`start_date <= ${ph(params, filter.overlapEnd)}`);
    }
    if (where.length) {
      sql.push('WHERE ' + where.join(' AND '));
    }
    sql.push('ORDER BY sort_order ASC, id ASC');

    const rows = await db.select<Record<string, any>[]>(sql.join(' '), params);
    return rows.map(normalizeTask);
  },

  async getTask(id: string): Promise<Task | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, any>[]>('SELECT * FROM tasks WHERE id = $1', [id]);
    return rows.length ? normalizeTask(rows[0]) : null;
  },

  async createTask(input: NewTask): Promise<Task> {
    const db = await getDb();
    const params: unknown[] = [];
    // 三个上级 id 由调用方（UI）直接传入，缺失则为 null
    const record: Record<string, any> = { ...(input as Record<string, any>) };
    // id 缺省时生成 UUID，保证云端与本地主键一致
    if (!record.id) record.id = newId();
    const columns = ['id', ...TASK_COLUMNS];
    // 保证各列均有占位符（id 一定有值，其余缺失置 NULL）
    const values = columns.map(col => ph(params, record[col] ?? null));
    const rows = await db.select<Record<string, any>[]>(
      `INSERT INTO tasks (${columns.join(', ')}) VALUES (${values.join(', ')}) RETURNING *`,
      params
    );
    return normalizeTask(rows[0]);
  },

  async updateTask(id: string, patch: Partial<NewTask>): Promise<Task> {
    const db = await getDb();
    const params: unknown[] = [];
    // patch 直接包含三个上级 id（调用方在改父任务时会一并传入），缺失则不更新
    const sets = Object.entries(patch)
      .filter(([key]) => TASK_COLUMNS.has(key))
      .map(([key, value]) => `${key} = ${ph(params, value ?? null)}`);
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    const rows = await db.select<Record<string, any>[]>(
      `UPDATE tasks SET ${sets.join(', ')} WHERE id = ${ph(params, id)} RETURNING *`,
      params
    );
    return normalizeTask(rows[0]);
  },

  async deleteTask(id: string): Promise<{ deleted: string[]; blocked: string[] }> {
    const db = await getDb();
    // 计算任务子树（含自身）的已执行情况，删除其中未执行的任务，已执行（有番茄记录）的任务予以保留
    const subtreeIds = await localRepository.getTaskSubtreeIds(id);
    const counts = await localRepository.countPomodoroRecords(subtreeIds);
    const blocked = subtreeIds.filter(tid => (counts[tid] ?? 0) > 0);
    const deletable = subtreeIds.filter(tid => !(counts[tid] ?? 0));

    if (deletable.length) {
      const placeholders = deletable.map((_, i) => `$${i + 1}`).join(', ');
      await db.execute(
        `UPDATE tasks
         SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
        deletable
      );
    }
    return { deleted: deletable, blocked };
  },

  async getTaskSubtreeIds(id: string): Promise<string[]> {
    const db = await getDb();
    const rows = await db.select<{ id: string }[]>(
      `WITH RECURSIVE sub(id) AS (
         SELECT id FROM tasks WHERE id = $1
         UNION
         SELECT t.id FROM tasks t JOIN sub s ON t.quarter_id = s.id OR t.month_id = s.id OR t.week_id = s.id
       )
       SELECT id FROM sub`,
      [id]
    );
    return rows.map(r => r.id);
  },

  async countPomodoroRecords(taskIds: string[]): Promise<Record<string, number>> {
    if (!taskIds.length) return {};
    const db = await getDb();
    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await db.select<{ task_id: string; cnt: number }[]>(
      `SELECT task_id, COUNT(*) AS cnt FROM pomodoro_records
       WHERE task_id IN (${placeholders})
       GROUP BY task_id`,
      taskIds
    );
    const result: Record<string, number> = {};
    for (const row of rows) result[row.task_id] = Number(row.cnt);
    return result;
  },

  async listPomodoroRecords(filter: PomodoroRecordFilter = {}): Promise<PomodoroRecord[]> {
    const db = await getDb();
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.taskId !== undefined) {
      where.push(`task_id = ${ph(params, filter.taskId)}`);
    }
    if (filter.recordDate) {
      where.push(`record_date = ${ph(params, filter.recordDate)}`);
    }
    if (filter.startDate) {
      where.push(`record_date >= ${ph(params, filter.startDate)}`);
    }
    if (filter.endDate) {
      where.push(`record_date <= ${ph(params, filter.endDate)}`);
    }
    const sql =
      'SELECT * FROM pomodoro_records' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY id ASC';
    const rows = await db.select<Record<string, any>[]>(sql, params);
    return rows.map(normalizePomodoroRecord) as PomodoroRecord[];
  },

  async createPomodoroRecord(input: NewPomodoroRecord): Promise<PomodoroRecord> {
    const db = await getDb();
    const id = input.id ?? newId();
    const rows = await db.select<Record<string, any>[]>(
      `INSERT INTO pomodoro_records (id, task_id, record_date, start_time, end_time,
        effective_total_seconds, status, resume_count, interrupt_duration_seconds, reward_gold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        id,
        input.task_id,
        input.record_date,
        input.start_time,
        input.end_time,
        input.effective_total_seconds,
        input.status,
        input.resume_count ?? 0,
        input.interrupt_duration_seconds ?? null,
        input.reward_gold ?? 0,
      ]
    );
    return normalizePomodoroRecord(rows[0]) as PomodoroRecord;
  },

  async countCompletedPomodoros(taskIds: string[]): Promise<Record<string, number>> {
    if (!taskIds.length) return {};
    const db = await getDb();
    const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await db.select<{ task_id: string; cnt: number }[]>(
      `SELECT task_id, COUNT(*) AS cnt FROM pomodoro_records
       WHERE status = 'completed' AND task_id IN (${placeholders})
       GROUP BY task_id`,
      taskIds
    );
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.task_id] = Number(row.cnt);
    }
    return result;
  },

  async getSetting(key: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ value: string }[]>(
      'SELECT value FROM app_settings WHERE key = $1',
      [key]
    );
    return rows.length ? rows[0].value : null;
  },

  async setSetting(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  },

  // ---- user_pomo_schedule ----
  async getActivePomoSchedule(): Promise<PomoSchedule | null> {
    const db = await getDb();
    const rows = await db.select<Record<string, any>[]>(
      'SELECT * FROM user_pomo_schedule WHERE end_date IS NULL ORDER BY start_date DESC LIMIT 1'
    );
    return rows.length ? normalizePomoSchedule(rows[0]) : null;
  },

  async savePomoSchedule(input: {
    pomodoro_work_minutes: number;
    daily_pomo_count: number;
  }): Promise<PomoSchedule> {
    const db = await getDb();
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    // 关闭当前生效段（end_date 置为昨日）
    await db.execute('UPDATE user_pomo_schedule SET end_date = $1 WHERE end_date IS NULL', [
      yesterday,
    ]);
    // 新增从今天起生效的新段
    const rows = await db.select<Record<string, any>[]>(
      `INSERT INTO user_pomo_schedule (id, start_date, end_date, pomodoro_work_minutes, daily_pomo_count)
       VALUES ($1, $2, NULL, $3, $4) RETURNING *`,
      [newId(), today, input.pomodoro_work_minutes, input.daily_pomo_count]
    );
    return normalizePomoSchedule(rows[0]);
  },
};
