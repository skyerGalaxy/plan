import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { usePlanerStore } from '@/stores/planStore';
import {
  getRepository,
  withFinishedCounts,
  quarterRange,
  monthRange,
  weekRange,
  overlapsRange,
} from '@/api';

dayjs.extend(quarterOfYear);

export const getCurrentDate = async () => {
  //fetch the current date
  const currentYear = dayjs().year();
  const currentQuarter = dayjs().quarter();
  //.month() returns 0-11, so we add 1 to get 1-12
  const currentMonth = dayjs().month() + 1;

  //get the week index in the current month
  const weekInMonth = Math.ceil(dayjs().date() / 7);
  //Open the app to display the number of days, the default is in the day view
  const daysOfWeek = getDaysOfWeek(weekInMonth);
  //Initial slideIndex
  const daysInWeek = dayjs().date() % 7 == 0 ? 7 : dayjs().date() % 7;

  //initial active index for every cycle view
  const quarterActiveIndex = currentQuarter - 1;
  const monthActiveIndex = currentMonth - (currentQuarter - 1) * 3 - 1;
  const weekActiveIndex = weekInMonth - 1;
  const dayActiveIndex = daysInWeek - 1;

  const repo = getRepository();

  //按各视图的日期区间并行加载四类任务（period_type：1季 2月 3周 4日）
  const [initQuarterData, initMonthData, initWeekData, initDayData] = (await Promise.all([
    repo.listTasks({
      periodType: 1,
      overlapStart: `${currentYear}-01-01`,
      overlapEnd: `${currentYear}-12-31`,
    }),
    repo.listTasks({ periodType: 2, ...quarterRange(currentYear, currentQuarter) }),
    repo.listTasks({ periodType: 3, ...monthRange(currentYear, currentMonth) }),
    withFinishedCounts(
      await repo.listTasks({ periodType: 4, ...weekRange(currentYear, currentMonth, weekInMonth) })
    ),
  ])) as any[][];

  const planStore = usePlanerStore();
  planStore.$patch({
    year: currentYear,
    quarter: currentQuarter,
    month: currentMonth,
    slideCount: daysOfWeek,
    weekViewIndex: weekInMonth,
    dayViewIndex: daysInWeek,
    quarterActiveIndex: quarterActiveIndex,
    monthActiveIndex: monthActiveIndex,
    weekActiveIndex: weekActiveIndex,
    dayActiveIndex: dayActiveIndex,
    quarterData: initQuarterData,
    monthData: initMonthData,
    weekData: initWeekData,
    dayData: initDayData,
    parentData: initWeekData.filter(
      task =>
        !task.is_cyclic && overlapsRange(task, weekRange(currentYear, currentMonth, weekInMonth))
    ),
  });

  return {
    year: currentYear,
    quarter: currentQuarter,
    month: currentMonth,
    daysOfWeek: daysOfWeek,
    daysInWeek: daysInWeek,
  };
};

function getDaysOfWeek(currentWeek: number) {
  const daysInMonth = dayjs().daysInMonth();
  if (currentWeek * 7 <= daysInMonth) {
    return 7;
  } else {
    return daysInMonth - (currentWeek - 1) * 7;
  }
}
