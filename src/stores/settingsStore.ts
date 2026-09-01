import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getRepository } from '@/api';
import type { PomoSchedule } from '@/api';

/**
 * 应用设置中心
 * - 常规设置与番茄钟全局配置（休息/提醒类）持久化到 app_settings 表
 * - 番茄钟时段配置（每日数量 + 专注时长）持久化到 user_pomo_schedule 表（按时间段留档）
 */
export const useSettingsStore = defineStore('settings', () => {
  // ---- 常规设置 ----
  // 默认任务周期（进入计划页时的初始视图）：1 季 2 月 3 周 4 日
  const defaultCycle = ref<number>(4);
  // 一周起始日：0 周日 / 1 周一
  const weekStartsOn = ref<number>(1);
  // 是否隐藏已完成任务（联动计划页 HideSwitch 默认值）
  const hideCompleted = ref<boolean>(false);

  // ---- 番茄钟时段配置（user_pomo_schedule 当前生效段）----
  const dailyPomodoroTarget = ref<number>(8); // 每日番茄钟数量
  const workMinutes = ref<number>(25); // 专注时长（分钟）
  const activeSchedule = ref<PomoSchedule | null>(null); // 当前生效配置段

  // ---- 番茄钟全局配置（app_settings）----
  const shortBreakMinutes = ref<number>(5);
  const longBreakMinutes = ref<number>(15);
  const longBreakInterval = ref<number>(4); // 每完成 N 个番茄进入长休息
  const autoStartBreak = ref<boolean>(true); // 完成后自动进入休息
  const forceBreakScreen = ref<boolean>(true); // 休息时打开强制休息界面
  const autoStartWork = ref<boolean>(false); // 休息后自动开始下一个番茄
  const workStartReminder = ref<boolean>(false); // 工作时打开开始提醒界面

  // ---- 已在加载中，避免并发重复读取 ----
  let loaded = false;

  async function load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    const repo = getRepository();

    // 优先从 user_pomo_schedule 读取当前生效段的每日数量与专注时长
    let scheduleLoaded = false;
    try {
      const schedule = await repo.getActivePomoSchedule();
      if (schedule) {
        activeSchedule.value = schedule;
        dailyPomodoroTarget.value = schedule.daily_pomo_count;
        workMinutes.value = schedule.pomodoro_work_minutes;
        scheduleLoaded = true;
      }
    } catch (e) {
      console.error('加载番茄钟时段配置失败', e);
    }

    // 其余设置从 app_settings 读取（每日数量/专注时长仅在无生效段时作为兜底）
    const map: Record<string, (v: string) => void> = {
      'settings.defaultCycle': v => (defaultCycle.value = Number(v) || 4),
      'settings.weekStartsOn': v => (weekStartsOn.value = Number(v) || 1),
      'settings.hideCompleted': v => (hideCompleted.value = v === 'true'),
      'settings.dailyPomodoroTarget': v => {
        if (!scheduleLoaded) dailyPomodoroTarget.value = Number(v) || 8;
      },
      'settings.workMinutes': v => {
        if (!scheduleLoaded) workMinutes.value = Number(v) || 25;
      },
      'settings.shortBreakMinutes': v => (shortBreakMinutes.value = Number(v) || 5),
      'settings.longBreakMinutes': v => (longBreakMinutes.value = Number(v) || 15),
      'settings.longBreakInterval': v => (longBreakInterval.value = Number(v) || 4),
      'settings.autoStartBreak': v => (autoStartBreak.value = v === 'true'),
      'settings.autoStartWork': v => (autoStartWork.value = v === 'true'),
      'settings.forceBreakScreen': v => (forceBreakScreen.value = v === 'true'),
      'settings.workStartReminder': v => (workStartReminder.value = v === 'true'),
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
    const raw = String(value);
    try {
      await getRepository().setSetting(key, raw);
    } catch (e) {
      console.error(`保存设置 ${key} 失败`, e);
    }
  }

  /** 保存当前生效时段的每日数量与专注时长（user_pomo_schedule：关闭旧段 + 新增今日起新段） */
  async function saveSchedule(): Promise<void> {
    const repo = getRepository();
    const schedule = await repo.savePomoSchedule({
      pomodoro_work_minutes: workMinutes.value,
      daily_pomo_count: dailyPomodoroTarget.value,
    });
    activeSchedule.value = schedule;
  }

  return {
    defaultCycle,
    weekStartsOn,
    hideCompleted,
    dailyPomodoroTarget,
    workMinutes,
    activeSchedule,
    shortBreakMinutes,
    longBreakMinutes,
    longBreakInterval,
    autoStartBreak,
    forceBreakScreen,
    autoStartWork,
    workStartReminder,
    load,
    set,
    saveSchedule,
  };
});
