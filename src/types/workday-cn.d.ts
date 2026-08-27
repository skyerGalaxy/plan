declare module 'workday-cn' {
  interface WorkdayCn {
    /** 判断指定日期是否为工作日（包含调休） */
    isWorkday(date: string | Date): boolean;
    /** 判断指定日期是否为法定节假日 */
    isHoliday(date: string | Date): boolean;
    /** 判断指定日期是否为周末（自然周末） */
    isWeekend(date: string | Date): boolean;
    /** 判断指定日期是否为周中工作日（周一至周五，不含调休） */
    isWeekday(date: string | Date): boolean;
    /** 获取两个日期之间的所有工作日 */
    getWorkdaysBetween(start: string | Date, end: string | Date): Date[];
    /** 获取指定日期的类型：workday | holiday | weekend */
    getDateType(date: string | Date): 'workday' | 'holiday' | 'weekend';
    /** 获取指定日期之后的第一个工作日 */
    getNextWorkday(date: string | Date): Date;
    /** 获取指定日期所在周/月的所有工作日 */
    getWorkdays(date: string | Date, type?: 'week' | 'month'): Date[];
    /** 获取指定月份的工作日数量 */
    getMonthWorkdays(year: number, month: number): number;
  }

  const workdayCn: WorkdayCn;
  export default workdayCn;
}
