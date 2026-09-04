/**
 * 番茄钟后端命令与事件封装。
 * 所有状态流转由 Rust 后端负责，前端仅通过 invoke 触发命令、订阅事件做纯渲染。
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PomodoroRecordSync } from './types';

export type { UnlistenFn, PomodoroRecordSync };

/** 后端统一广播/返回的状态负载 */
export interface PomodoroStatePayload {
  task_id: string | null;
  /** 循环任务具体实例日期（YYYY-MM-DD）；非循环/空闲为 null */
  occurrence_date: string | null;
  task_title: string;
  status: 'running' | 'paused' | 'interrupted_saved' | 'completed' | 'idle';
  remain_seconds: number;
  resume_count: number;
  target_seconds: number;
  effective_seconds: number;
  reward_gold: number;
}

const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** 开始番茄钟（返回新状态；若已有其它任务进行中则抛错） */
export function startPomodoro(
  taskId: string,
  occurrenceDate: string | null = null
): Promise<PomodoroStatePayload> {
  return invoke('start_pomodoro', { taskId, occurrenceDate });
}

/** 暂停（running → paused） */
export function pausePomodoro(): Promise<PomodoroStatePayload> {
  return invoke('pause_pomodoro');
}

/** 继续运行（paused → running） */
export function resumePomodoro(): Promise<PomodoroStatePayload> {
  return invoke('resume_pomodoro');
}

/** 中断保存（running → interrupted_saved） */
export function interruptSavePomodoro(): Promise<PomodoroStatePayload> {
  return invoke('interrupt_save_pomodoro');
}

/** 获取当前状态（页面初始化） */
export async function getPomodoroState(): Promise<PomodoroStatePayload | null> {
  if (!inTauri) return null;
  return invoke('get_pomodoro_state');
}

/** 订阅全局番茄钟状态事件，返回取消函数 */
export async function onPomodoroStateUpdate(
  handler: (payload: PomodoroStatePayload) => void
): Promise<UnlistenFn | null> {
  if (!inTauri) return null;
  return listen<PomodoroStatePayload>('pomodoro_state_update', event => handler(event.payload));
}

/** 订阅全局番茄记录同步事件（后端每次写库后广播，前端幂等 upsert 到云端），返回取消函数 */
export async function onPomodoroRecordSync(
  handler: (payload: PomodoroRecordSync) => void
): Promise<UnlistenFn | null> {
  if (!inTauri) return null;
  return listen<PomodoroRecordSync>('pomodoro_record_sync', event => handler(event.payload));
}

/** 读取专注模式（桌面宠物）开关 */
export async function getFocusMode(): Promise<boolean> {
  if (!inTauri) return false;
  return invoke('get_focus_mode');
}

/** 设置专注模式（桌面宠物）开关 */
export async function setFocusMode(enabled: boolean): Promise<void> {
  if (!inTauri) return;
  return invoke('set_focus_mode', { enabled });
}

/** 保存桌宠窗口位置（拖拽松开时调用） */
export async function savePetPosition(x: number, y: number): Promise<void> {
  if (!inTauri) return;
  return invoke('save_pet_position', { x, y });
}

/** 唤起并聚焦主窗口（桌宠召回 / 返回任务列表） */
export async function showMainWindow(): Promise<void> {
  if (!inTauri) return;
  return invoke('show_main_window');
}
