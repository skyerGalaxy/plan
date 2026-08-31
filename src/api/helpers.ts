import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { getWeekDateRange } from '@/utils/holiday';
import type { Task } from './types';

dayjs.extend(quarterOfYear);

export interface DateRange {
  start: string; // YYYY-MM-DD（含）
  end: string; // YYYY-MM-DD（含）
}

/** 某年某季度的日期范围 */
export function quarterRange(year: number, quarter: number): DateRange {
  const startMonth = (quarter - 1) * 3 + 1;
  return {
    start: dayjs(`${year}-${startMonth}-01`).format('YYYY-MM-DD'),
    end: dayjs(`${year}-${startMonth + 2}-01`)
      .endOf('month')
      .format('YYYY-MM-DD'),
  };
}

/** 某年某月的日期范围 */
export function monthRange(year: number, month: number): DateRange {
  const first = dayjs(`${year}-${month}-01`);
  return {
    start: first.format('YYYY-MM-DD'),
    end: first.endOf('month').format('YYYY-MM-DD'),
  };
}

/** 某月第 weekIndex 周（1~7日划分）的日期范围 */
export function weekRange(year: number, month: number, weekIndex: number): DateRange {
  const r = getWeekDateRange(year, month, weekIndex);
  return { start: r.start, end: r.end };
}

/** 单日范围 */
export function dayRange(date: string): DateRange {
  return { start: date, end: date };
}

/** 视图上下文 */
export interface PeriodContext {
  year: number;
  quarter: number;
  month: number;
  weekViewIndex: number;
  /** 日视图当前滑块日期 */
  slideDate?: string;
}

/** 按 period_type 计算当前视图上下文对应的日期范围（1季 2月 3周 4日） */
export function getPeriodRange(periodType: number, ctx: PeriodContext): DateRange {
  switch (periodType) {
    case 1:
      return quarterRange(ctx.year, ctx.quarter);
    case 2:
      return monthRange(ctx.year, ctx.month);
    case 3:
      return weekRange(ctx.year, ctx.month, ctx.weekViewIndex);
    case 4:
      return dayRange(ctx.slideDate || dayjs().format('YYYY-MM-DD'));
    default:
      return dayRange(dayjs().format('YYYY-MM-DD'));
  }
}

export function overlapsRange(task: Task, range: DateRange): boolean {
  return task.start_date <= range.end && task.end_date >= range.start;
}

/** Add 到循环计算场景的最大遍历护栏（防止异常日期死循环） */
const MAX_COUNT_STEPS = 100000;

/**
 * 计算循环规则在闭区间 [start, end] 内的触发次数（用于循环任务总番茄配额计算）。
 * 规则与 LoopRuleModal 保持一致：cycle_daily / cycle_workday / cycle_weekend /
 * cycle_weekly_days{days:1..7} / cycle_monthly_days{days:1..31}；rule 为空视为单次。
 */
export function countRuleOccurrences(rule: string | null, start: string, end: string): number {
  if (!rule) return 1;
  let type = '';
  let days: number[] = [];
  try {
    const parsed = JSON.parse(rule);
    type = parsed?.type || '';
    days = Array.isArray(parsed?.days) ? parsed.days : [];
  } catch {
    return 1;
  }
  const s = dayjs(start);
  const e = dayjs(end);
  if (!s.isValid() || !e.isValid()) return 1;

  if (type === 'cycle_daily') return e.diff(s, 'day') + 1;

  // 周日 = 0，映射与 LoopRuleModal.nextWeeklyDays 一致（周一=1..周六=6、周日=0）
  const weekdaySet = new Set(days.map(d => d % 7));
  const monthlySet = new Set(days.filter(d => d >= 1 && d <= 31));

  let count = 0;
  let day = s;
  let guard = 0;
  while ((day.isBefore(e) || day.isSame(e)) && guard++ < MAX_COUNT_STEPS) {
    const w = day.day();
    const match =
      (type === 'cycle_workday' && w >= 1 && w <= 5) ||
      (type === 'cycle_weekend' && (w === 0 || w === 6)) ||
      (type === 'cycle_weekly_days' && weekdaySet.has(w)) ||
      (type === 'cycle_monthly_days' && monthlySet.has(day.date()));
    if (match) count++;
    day = day.add(1, 'day');
  }
  return count;
}

/** 生成 UUID v4 字符串（云端与本地主键共用，保证两端一致） */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 兜底：无 crypto.randomUUID 环境（极少见）用随机 hex 拼接
  const s = () => Math.random().toString(16).slice(2, 10);
  return [s(), s(), s(), s(), s()].join('-');
}

/** 归一化数据库返回的任务行（SQLite/Supabase 数值与布尔差异） */
export function normalizeTask(row: Record<string, any>): Task {
  return {
    ...row,
    period_type: Number(row.period_type),
    total_pomodoro_quota: Number(row.total_pomodoro_quota ?? 0),
    pomodoro_per_occurrence: Number(row.pomodoro_per_occurrence ?? 0),
    is_cyclic: row.is_cyclic ? 1 : 0,
    sort_order: Number(row.sort_order ?? 0),
    quarter_id: row.quarter_id ?? null,
    month_id: row.month_id ?? null,
    week_id: row.week_id ?? null,
    cycle_rule: row.cycle_rule ?? null,
    status: row.status || 'pending',
  } as Task;
}

/**
 * 归一化番茄记录行
 */
export function normalizePomodoroRecord(row: Record<string, any>) {
  return {
    ...row,
    duration_minutes: Number(row.duration_minutes ?? 0),
    end_time: row.end_time ?? null,
  };
}
