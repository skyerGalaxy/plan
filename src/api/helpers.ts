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
    is_cyclic: row.is_cyclic ? 1 : 0,
    sort_order: Number(row.sort_order ?? 0),
    parent_id: row.parent_id ?? null,
    cycle_rule: row.cycle_rule ?? null,
    status: row.status || 'pending',
  } as Task;
}

/** 归一化番茄记录行 */
export function normalizePomodoroRecord(row: Record<string, any>) {
  return {
    ...row,
    duration_minutes: Number(row.duration_minutes ?? 0),
    end_time: row.end_time ?? null,
  };
}
