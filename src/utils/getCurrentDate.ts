import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { usePlanerStore } from '@/stores/planStore';

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
  });

  // 并行加载四类任务（季/月/周/日），parentData 由 store 内 computed 派生
  await planStore.init();

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
