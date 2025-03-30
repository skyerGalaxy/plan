import { defineStore } from 'pinia';
import { ref } from 'vue';
import dayjs from 'dayjs';

function calculateDaysInMonth(year: number, month: number): number {
  return dayjs(`${year}-${month}-01`).daysInMonth();
}

export const usePlanerStore = defineStore('planer', () => {
  const cycleValue = ref<number>(4);
  const year = ref<number>(0);
  const quarter = ref<number>(0);
  const month = ref<number>(0);
  const slideCount = ref<number>(0);
  const weekViewIndex = ref<number>(0); //current week index in month,1,2,3,4,...
  const dayViewIndex = ref<number>(0);

  //active index for every cycle view
  const quarterActiveIndex = ref<number>(0);
  const monthActiveIndex = ref<number>(0);
  const weekActiveIndex = ref<number>(0);
  const dayActiveIndex = ref<number>(0);

  //data for every cycle view
  const quarterData = ref<any[]>([]);
  const monthData = ref<any[]>([]);
  const weekData = ref<any[]>([]);
  const dayData = ref<any[]>([]);
  const parentData = ref<any[]>([]); //父任务数据

  // 年份是否发生变化的标志
  const yearChange = ref<boolean>(false);
  const isDayDataChanged = ref<boolean>(false);
  const isWeekDataChanged = ref<boolean>(false);
  const isMonthDataChanged = ref<boolean>(false);
  const isQuarterDataChanged = ref<boolean>(false);

  function getSlideCount(): number {
    switch (cycleValue.value) {
      case 1:
        return 4;
      case 2:
        return 3;
      case 3:
        return Math.ceil(calculateDaysInMonth(year.value, month.value) / 7);
      case 4:
        const daysInSelectedMonth = calculateDaysInMonth(year.value, month.value);
        return weekViewIndex.value * 7 <= daysInSelectedMonth
          ? 7
          : daysInSelectedMonth - (weekViewIndex.value - 1) * 7;
      default:
        return 7;
    }
  }

  return {
    cycleValue,
    year,
    quarter,
    month,
    slideCount,
    weekViewIndex,
    dayViewIndex,
    quarterActiveIndex,
    monthActiveIndex,
    weekActiveIndex,
    dayActiveIndex,
    quarterData,
    monthData,
    weekData,
    dayData,
    parentData,
    getSlideCount,
    yearChange,
    isDayDataChanged,
    isWeekDataChanged,
    isMonthDataChanged,
    isQuarterDataChanged,
  };
});
