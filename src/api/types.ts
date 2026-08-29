/**
 * 数据层类型定义：与 SQLite 三张表（tasks / pomodoro_records / app_settings）一一对应，
 * 云端 Supabase 使用同构的表结构，两端共用本套类型与仓库接口。
 */

/** 任务状态 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/** tasks 表实体（period_type：1季 2月 3周 4日）；主键为 UUID 字符串，云端与本地一致 */
export interface Task {
  id: string;
  parent_id: string | null; // 父任务：月→季、周→月、日→周；季任务为 null
  title: string;
  description: string;
  period_type: 1 | 2 | 3 | 4;
  total_pomodoro_quota: number; // 番茄配额（日任务使用）
  start_date: string; // YYYY-MM-DD，周期开始日
  end_date: string; // YYYY-MM-DD，周期结束日
  is_cyclic: 0 | 1; // 是否循环任务
  cycle_rule: string | null; // 循环规则 JSON 字符串（cycle_daily / cycle_workday / ...）
  sort_order: number; // 排序/优先级（原 range 字段）
  status: TaskStatus;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null; // 软删除标记
}

/** 新建任务输入（时间戳由数据库生成；id 为可选，缺省时由数据层生成 UUID 保证云端本地一致） */
export type NewTask = Partial<Pick<Task, 'id'>> &
  Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>;

/** pomodoro_records 表实体 */
export interface PomodoroRecord {
  id: string;
  task_id: string;
  record_date: string; // YYYY-MM-DD
  start_time: string; // ISO DATETIME
  end_time: string | null;
  duration_minutes: number;
  status: 'completed' | 'interrupted';
  created_at?: string;
}

/** 新建番茄记录输入 */
export type NewPomodoroRecord = Partial<Pick<PomodoroRecord, 'id'>> &
  Omit<PomodoroRecord, 'id' | 'created_at'>;

/** 任务过滤条件 */
export interface TaskFilter {
  periodType?: 1 | 2 | 3 | 4;
  /** 任务区间 [start_date, end_date] 与 [overlapStart, overlapEnd] 存在交集 */
  overlapStart?: string;
  overlapEnd?: string;
  isCyclic?: 0 | 1;
  /** 精确父任务过滤；传 null 仅匹配根任务 */
  parentId?: string | null;
  includeDeleted?: boolean;
}

/** 番茄记录过滤条件 */
export interface PomodoroRecordFilter {
  taskId?: number;
  recordDate?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 三表统一的增删改查仓库接口。
 * localRepository（Tauri + SQLite）与 cloudRepository（Supabase）各实现一份，
 * UI 只依赖此接口，不感知底层存储。
 */
export interface TaskRepository {
  // ---- tasks ----
  listTasks(filter?: TaskFilter): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: Partial<NewTask>): Promise<Task>;
  /** 软删除任务（连同其全部子孙任务置 deleted_at） */
  deleteTask(id: string): Promise<void>;

  // ---- pomodoro_records ----
  listPomodoroRecords(filter?: PomodoroRecordFilter): Promise<PomodoroRecord[]>;
  createPomodoroRecord(input: NewPomodoroRecord): Promise<PomodoroRecord>;
  /** 统计任务已完成番茄数，返回 { taskId: count } */
  countCompletedPomodoros(taskIds: string[]): Promise<Record<string, number>>;

  // ---- app_settings ----
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
