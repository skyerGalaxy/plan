import Database from '@tauri-apps/plugin-sql';
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

/** tasks 表可更新的列白名单（防止动态拼 SQL 注入） */
const TASK_COLUMNS = new Set([
  'parent_id',
  'title',
  'description',
  'period_type',
  'total_pomodoro_quota',
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
    if (filter.parentId !== undefined) {
      where.push(
        filter.parentId === null
          ? 'parent_id IS NULL'
          : `parent_id = ${ph(params, filter.parentId)}`
      );
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
    const record = input as Record<string, any>;
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

  async deleteTask(id: string): Promise<void> {
    const db = await getDb();
    // 递归软删除：任务自身 + 全部子孙任务
    await db.execute(
      `WITH RECURSIVE sub(id) AS (
         SELECT id FROM tasks WHERE id = $1
         UNION ALL
         SELECT t.id FROM tasks t JOIN sub s ON t.parent_id = s.id
       )
       UPDATE tasks
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (SELECT id FROM sub)`,
      [id]
    );
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
      `INSERT INTO pomodoro_records (id, task_id, record_date, start_time, end_time, duration_minutes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        id,
        input.task_id,
        input.record_date,
        input.start_time,
        input.end_time,
        input.duration_minutes,
        input.status,
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
};
