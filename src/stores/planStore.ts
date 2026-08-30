import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import dayjs from 'dayjs';
import {
  getRepository,
  withFinishedCounts,
  quarterRange,
  monthRange,
  weekRange,
  dayRange,
  overlapsRange,
  type Task,
} from '@/api';

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
  const quarterData = ref<Task[]>([]);
  const monthData = ref<Task[]>([]);
  const weekData = ref<Task[]>([]);
  const dayData = ref<Task[]>([]);

  // 年份是否发生变化的标志
  const yearChange = ref<boolean>(false);
  const isDayDataChanged = ref<boolean>(false);
  const isWeekDataChanged = ref<boolean>(false);
  const isMonthDataChanged = ref<boolean>(false);
  const isQuarterDataChanged = ref<boolean>(false);

  // 是否正在加载（供 UI 显示 loading）
  const loading = ref<boolean>(false);

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

  /** 当前视图使用的数据（按 cycleValue 派生） */
  const currentData = computed<Task[]>(() => {
    switch (cycleValue.value) {
      case 1:
        return quarterData.value;
      case 2:
        return monthData.value;
      case 3:
        return weekData.value;
      case 4:
        return dayData.value;
      default:
        return [];
    }
  });

  /** 当前滑块上下文对应的日期范围 */
  function currentRange() {
    switch (cycleValue.value) {
      case 2:
        return quarterRange(year.value, quarter.value);
      case 3:
        return monthRange(year.value, month.value);
      case 4:
        return weekRange(year.value, month.value, weekViewIndex.value);
      default:
        return quarterRange(year.value, quarter.value);
    }
  }

  /** 父任务候选：上一级粒度中与当前区间有交集的非循环任务（日→周、周→月、月→季） */
  const parentData = computed<Task[]>(() => {
    const range = currentRange();
    switch (cycleValue.value) {
      case 2:
        return quarterData.value.filter(t => !t.is_cyclic && overlapsRange(t, range));
      case 3:
        return monthData.value.filter(t => !t.is_cyclic && overlapsRange(t, range));
      case 4:
        return weekData.value.filter(t => !t.is_cyclic && overlapsRange(t, range));
      default:
        return [];
    }
  });

  /** 按 period_type 加载某一级数据（日视图附加已完成番茄数） */
  async function loadPeriod(periodType: number) {
    const repo = getRepository();
    switch (periodType) {
      case 1:
        quarterData.value = await repo.listTasks({
          periodType: 1,
          overlapStart: `${year.value}-01-01`,
          overlapEnd: `${year.value}-12-31`,
        });
        break;
      case 2:
        monthData.value = await repo.listTasks({
          periodType: 2,
          ...quarterRange(year.value, quarter.value),
        });
        break;
      case 3:
        weekData.value = await repo.listTasks({
          periodType: 3,
          ...monthRange(year.value, month.value),
        });
        break;
      case 4:
        dayData.value = await withFinishedCounts(
          await repo.listTasks({
            periodType: 4,
            ...weekRange(year.value, month.value, weekViewIndex.value),
          })
        );
        break;
    }
  }

  /** 增量加载：仅刷新当前视图数据，不触碰其他视图缓存 */
  async function refreshCurrent() {
    loading.value = true;
    try {
      await loadPeriod(cycleValue.value);
      // 切换/滑块后，父任务依赖的上一级数据可能缺失，补拉一次
      if (
        (cycleValue.value === 2 && !quarterData.value.length) ||
        (cycleValue.value === 3 && !monthData.value.length) ||
        (cycleValue.value === 4 && !weekData.value.length)
      ) {
        await loadPeriod(cycleValue.value - 1);
      }
    } finally {
      loading.value = false;
    }
  }

  /** 完整初始化：加载四个视图数据 */
  async function init() {
    loading.value = true;
    try {
      await Promise.all([loadPeriod(1), loadPeriod(2), loadPeriod(3), loadPeriod(4)]);
    } finally {
      loading.value = false;
    }
  }

  /** 全量刷新四个视图数据（删除等会影响下级的操作后使用） */
  async function refreshAll() {
    loading.value = true;
    try {
      await Promise.all([loadPeriod(1), loadPeriod(2), loadPeriod(3), loadPeriod(4)]);
    } finally {
      loading.value = false;
    }
  }

  /** 按需刷新：仅重载指定层级数据（增改、修改循环规则等单层操作时使用，避免全量重拉） */
  async function refreshSelected(periods: number[]) {
    loading.value = true;
    try {
      await Promise.all([...new Set(periods)].map(p => loadPeriod(p)));
    } finally {
      loading.value = false;
    }
  }

  // 跨年切换时全量重新加载四个视图数据
  watch(yearChange, async v => {
    if (v) {
      await init();
      yearChange.value = false;
    }
  });

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
    currentData,
    parentData,
    getSlideCount,
    yearChange,
    isDayDataChanged,
    isWeekDataChanged,
    isMonthDataChanged,
    isQuarterDataChanged,
    loading,
    refreshCurrent,
    refreshAll,
    refreshSelected,
    init,
  };
});
