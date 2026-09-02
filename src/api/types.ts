/**
 * 数据层类型定义：与 SQLite 三张表（tasks / pomodoro_records / app_settings）一一对应，
 * 云端 Supabase 使用同构的表结构，两端共用本套类型与仓库接口。
 */

/** 任务状态 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/** tasks 表实体（period_type：1季 2月 3周 4日）；主键为 UUID 字符串，云端与本地一致 */
export interface Task {
  id: string;
  quarter_id: string | null; // 所属季任务 id（季任务为 null）
  month_id: string | null; // 所属月任务 id（季/月任务为 null）
  week_id: string | null; // 所属周任务 id（季/月/周任务为 null）
  title: string;
  description: string;
  period_type: 1 | 2 | 3 | 4;
  total_pomodoro_quota: number; // 番茄总配额（日任务=单次；循环任务=单次×触发次数；其他为 0）
  pomodoro_per_occurrence: number; // 单次任务所需番茄数（仅循环任务使用；非循环任务恒为 0）
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

/**
 * 新建任务输入（时间戳由数据库生成；id 为可选，缺省时由数据层生成 UUID 保证云端本地一致）。
 * quarter_id/month_id/week_id 调用方直接传入（由 UI 在选中父任务时解析），未传则为 null。
 */
export type NewTask = Partial<Pick<Task, 'id' | 'quarter_id' | 'month_id' | 'week_id'>> &
  Omit<
    Task,
    'id' | 'quarter_id' | 'month_id' | 'week_id' | 'created_at' | 'updated_at' | 'deleted_at'
  >;

/** pomodoro_records 表实体 */
export interface PomodoroRecord {
  id: string;
  task_id: string;
  record_date: string; // YYYY-MM-DD
  start_time: string; // ISO DATETIME
  end_time: string | null;
  effective_total_seconds: number; // 有效专注总时长（秒）
  status: 'completed' | 'interrupted';
  resume_count: number; // 续番茄次数
  interrupt_duration_seconds: number | null; // 中断时长（秒）
  reward_gold: number; // 奖励金币
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
 * user_pomo_schedule 表实体：某时间段内用户的番茄钟配置（每日数量 + 专注时长）。
 * start_date 为生效起始日；end_date 为失效日，NULL 表示当前生效段。
 */
export interface PomoSchedule {
  id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD；null 表示当前生效段
  pomodoro_work_minutes: number; // 番茄专注时长（分钟）
  daily_pomo_count: number; // 每日番茄钟数量
  created_at?: string;
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
  /**
   * 软删除任务：删除任务自身及其全部子孙中「未执行」的任务（有番茄记录的任务视为已执行，予以保留）。
   * 返回实际删除的 id 与保留（已执行不可删）的 id。
   */
  deleteTask(id: string): Promise<{ deleted: string[]; blocked: string[] }>;
  /** 返回某任务在层级树中的全部子孙 id（含自身），用于判断删除是否涉及已执行任务 */
  getTaskSubtreeIds(id: string): Promise<string[]>;

  // ---- pomodoro_records ----
  listPomodoroRecords(filter?: PomodoroRecordFilter): Promise<PomodoroRecord[]>;
  createPomodoroRecord(input: NewPomodoroRecord): Promise<PomodoroRecord>;
  /** 统计任务已完成番茄数，返回 { taskId: count } */
  countCompletedPomodoros(taskIds: string[]): Promise<Record<string, number>>;
  /** 统计任务全部番茄记录数（不限状态）上传是否存在已执行，返回 { taskId: count } */
  countPomodoroRecords(taskIds: string[]): Promise<Record<string, number>>;

  // ---- app_settings ----
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // ---- user_pomo_schedule ----
  /** 获取当前生效的番茄钟配置段（end_date IS NULL）；无记录返回 null */
  getActivePomoSchedule(): Promise<PomoSchedule | null>;
  /**
   * 保存新的番茄钟配置段：关闭当前生效段（end_date 置为昨日）并新增从今天开始的新段。
   * 用于用户修改每日数量/专注时长时按时间段留档。
   */
  savePomoSchedule(input: {
    pomodoro_work_minutes: number;
    daily_pomo_count: number;
  }): Promise<PomoSchedule>;
}
