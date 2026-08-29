import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getRepository } from '@/api';

/**
 * 应用设置中心
 * - 状态持久化到 app_settings 表（本地 SQLite / 云端 Supabase 同构）
 * - 所有 key 以 `settings.` 前缀存放，值统一为 JSON 字符串
 */
export const useSettingsStore = defineStore('settings', () => {
  // ---- 常规设置 ----
  // 默认任务周期（进入计划页时的初始视图）：1 季 2 月 3 周 4 日
  const defaultCycle = ref<number>(4);
  // 一周起始日：0 周日 / 1 周一
  const weekStartsOn = ref<number>(1);
  // 每天番茄目标个数（用于统计页展示）
  const dailyPomodoroTarget = ref<number>(8);
  // 是否隐藏已完成任务（联动计划页 HideSwitch 默认值）
  const hideCompleted = ref<boolean>(false);

  // ---- 番茄钟设置 ----
  const workMinutes = ref<number>(25);
  const shortBreakMinutes = ref<number>(5);
  const longBreakMinutes = ref<number>(15);
  const longBreakInterval = ref<number>(4); // 每完成 N 个番茄进入长休息
  const autoStartBreak = ref<boolean>(true); // 完成后自动进入休息
  const autoStartWork = ref<boolean>(false); // 休息后自动开始下一个番茄

  // ---- 已在加载中，避免并发重复读取 ----
  let loaded = false;

  async function load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    const repo = getRepository();
    const map: Record<string, (v: string) => void> = {
      'settings.defaultCycle': v => (defaultCycle.value = Number(v) || 4),
      'settings.weekStartsOn': v => (weekStartsOn.value = Number(v) || 1),
      'settings.dailyPomodoroTarget': v => (dailyPomodoroTarget.value = Number(v) || 8),
      'settings.hideCompleted': v => (hideCompleted.value = v === 'true'),
      'settings.workMinutes': v => (workMinutes.value = Number(v) || 25),
      'settings.shortBreakMinutes': v => (shortBreakMinutes.value = Number(v) || 5),
      'settings.longBreakMinutes': v => (longBreakMinutes.value = Number(v) || 15),
      'settings.longBreakInterval': v => (longBreakInterval.value = Number(v) || 4),
      'settings.autoStartBreak': v => (autoStartBreak.value = v === 'true'),
      'settings.autoStartWork': v => (autoStartWork.value = v === 'true'),
    };
    try {
      const entries = await Promise.all(
        Object.keys(map).map(async key => [key, await repo.getSetting(key)] as const)
      );
      for (const [key, value] of entries) {
        if (value != null) map[key](value);
      }
    } catch (e) {
      console.error('加载设置失败', e);
    }
  }

  /** 写入单个设置并持久化（prefix: 需带 settings. 前缀） */
  async function set(key: string, value: string | number | boolean): Promise<void> {
    const raw = typeof value === 'boolean' ? String(value) : String(value);
    try {
      await getRepository().setSetting(key, raw);
    } catch (e) {
      console.error(`保存设置 ${key} 失败`, e);
    }
  }

  return {
    defaultCycle,
    weekStartsOn,
    dailyPomodoroTarget,
    hideCompleted,
    workMinutes,
    shortBreakMinutes,
    longBreakMinutes,
    longBreakInterval,
    autoStartBreak,
    autoStartWork,
    load,
    set,
  };
});
