import type {
  Task,
  TaskFilter,
  TaskRepository,
  NewTask,
  NewPomodoroRecord,
  PomodoroRecord,
  PomodoroRecordFilter,
} from './types';
import { localRepository } from './localRepository';
import { cloudRepository } from './cloudRepository';
import { newId } from './helpers';

export * from './types';
export * from './helpers';

/** 是否运行在 Tauri 桌面端 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * 双写仓库（云端权威）。
 * - 写入：先云端，成功后写本地；云端失败则抛错且不写本地。
 * - 读取：优先云端（权威源，保证两端看到一致数据），云端不可用时回退本地。
 * - 本地写失败仅静默记录，不影响已成功写入云端的流程。
 */
const dualRepository: TaskRepository = {
  // ---- tasks（写：云→本地） ----
  async createTask(input: NewTask): Promise<Task> {
    const withId = { ...input, id: input.id ?? newId() };
    const cloud = await cloudRepository.createTask(withId); // 失败会抛错，下面不再执行
    await localWrite(() => localRepository.createTask(withId));
    return cloud;
  },

  async updateTask(id: string, patch: Partial<NewTask>): Promise<Task> {
    const cloud = await cloudRepository.updateTask(id, patch);
    await localWrite(() => localRepository.updateTask(id, patch));
    return cloud;
  },

  async deleteTask(id: string): Promise<void> {
    await cloudRepository.deleteTask(id);
    await localWrite(() => localRepository.deleteTask(id));
  },

  // ---- pomodoro_records（写：云→本地） ----
  async createPomodoroRecord(input: NewPomodoroRecord): Promise<PomodoroRecord> {
    const withId = { ...input, id: input.id ?? newId() };
    const cloud = await cloudRepository.createPomodoroRecord(withId);
    await localWrite(() => localRepository.createPomodoroRecord(withId));
    return cloud;
  },

  // ---- app_settings（写：云→本地） ----
  async setSetting(key: string, value: string): Promise<void> {
    await cloudRepository.setSetting(key, value);
    await localWrite(() => localRepository.setSetting(key, value));
  },

  // ---- tasks（读：云端优先，本地回退） ----
  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    return readOrLocal(() => cloudRepository.listTasks(filter), () =>
      localRepository.listTasks(filter)
    );
  },

  async getTask(id: string): Promise<Task | null> {
    return readOrLocal(
      () => cloudRepository.getTask(id),
      () => localRepository.getTask(id)
    );
  },

  // ---- pomodoro_records（读） ----
  async listPomodoroRecords(filter?: PomodoroRecordFilter): Promise<PomodoroRecord[]> {
    return readOrLocal(
      () => cloudRepository.listPomodoroRecords(filter),
      () => localRepository.listPomodoroRecords(filter)
    );
  },

  async countCompletedPomodoros(taskIds: string[]): Promise<Record<string, number>> {
    return readOrLocal(
      () => cloudRepository.countCompletedPomodoros(taskIds),
      () => localRepository.countCompletedPomodoros(taskIds)
    );
  },

  // ---- app_settings（读） ----
  async getSetting(key: string): Promise<string | null> {
    return readOrLocal(
      () => cloudRepository.getSetting(key),
      () => localRepository.getSetting(key)
    );
  },
};

/** 本地写入（仅 Tauri 环境执行；失败静默，不影响已成功的云端主流程） */
async function localWrite<T>(run: () => Promise<T>): Promise<void> {
  if (!isTauri()) return;
  try {
    await run();
  } catch (e) {
    console.error('本地写入失败（云端已成功）', e);
  }
}

/** 读取：云端优先，云端失败时（Tauri 环境）回退本地 */
async function readOrLocal<T>(fromCloud: () => Promise<T>, fromLocal: () => Promise<T>): Promise<T> {
  try {
    return await fromCloud();
  } catch (e) {
    if (isTauri()) {
      try {
        return await fromLocal();
      } catch {
        // 本地也失败则抛出云端原始错误
      }
    }
    throw e;
  }
}

let repository: TaskRepository | null = null;

/**
 * 获取数据仓库（云端权威的双写仓库）：
 * - 写入：先云端、后本地（云端失败本地不写）
 * - 读取：云端优先，本地回退
 */
export function getRepository(): TaskRepository {
  if (!repository) {
    repository = dualRepository;
  }
  return repository;
}

/** 为任务列表附加已完成番茄数（finished_pomodoro），由 pomodoro_records 聚合得出 */
export async function withFinishedCounts<T extends Task>(tasks: T[]): Promise<T[]> {
  const counts = await getRepository().countCompletedPomodoros(tasks.map(t => t.id));
  return tasks.map(task => ({ ...task, finished_pomodoro: counts[task.id] ?? 0 }));
}