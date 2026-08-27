import workdayCn from 'workday-cn';
import dayjs from 'dayjs';

/**
 * 中国节假日/工作日工具模块
 * 基于 workday-cn（内置国务院发布的法定节假日与调休数据）
 */

/** 判断某天是否为工作日（包含调休：周末补班算工作日，法定节假日算休息） */
export function isWorkday(date: string | Date): boolean {
  return workdayCn.isWorkday(date);
}

/** 判断某天是否为周末（自然周末，不区分是否调休） */
export function isWeekend(date: string | Date): boolean {
  return workdayCn.isWeekend(date);
}

/** 判断某天是否为法定节假日 */
export function isHoliday(date: string | Date): boolean {
  return workdayCn.isHoliday(date);
}

export interface WeekDateRange {
  /** 起始日期 YYYY-MM-DD */
  start: string;
  /** 结束日期 YYYY-MM-DD */
  end: string;
  /** 起始日号（1~31） */
  startDay: number;
  /** 结束日号（1~31） */
  endDay: number;
  /** 展示文本，如 "8.1~8.7" */
  text: string;
}

/**
 * 获取某月第 weekIndex 周的日期范围（第1周=1~7日，最后一周可能不足7天）
 */
export function getWeekDateRange(year: number, month: number, weekIndex: number): WeekDateRange {
  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const startDay = (weekIndex - 1) * 7 + 1;
  const endDay = Math.min(weekIndex * 7, daysInMonth);
  return {
    start: `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
    startDay,
    endDay,
    text: `${month}.${startDay}~${month}.${endDay}`,
  };
}

/** 计算某月第 weekIndex 周的工作日天数（含调休） */
export function countWorkdaysInWeek(year: number, month: number, weekIndex: number): number {
  const { start, end } = getWeekDateRange(year, month, weekIndex);
  return workdayCn.getWorkdaysBetween(start, end).length;
}

export interface DayTypeInfo {
  /** workday = 工作日，restday = 休息日 */
  type: 'workday' | 'restday';
  /** 细分说明：工作日 / 调休上班 / 周末 / 法定节假日 */
  subLabel: string;
}

/** 获取某天的工作/休息类型（考虑调休） */
export function getDayTypeInfo(date: string): DayTypeInfo {
  if (workdayCn.isWorkday(date)) {
    return {
      type: 'workday',
      subLabel: workdayCn.isWeekend(date) ? '调休上班' : '工作日',
    };
  }
  return {
    type: 'restday',
    subLabel: workdayCn.isHoliday(date) ? '法定节假日' : '周末',
  };
}
