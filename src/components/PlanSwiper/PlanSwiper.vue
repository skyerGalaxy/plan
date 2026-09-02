<script setup lang="ts">
  import { Swiper, SwiperSlide } from 'swiper/vue';
  import 'swiper/css';
  import 'swiper/css/effect-coverflow';
  import 'swiper/css/pagination';
  import { EffectCoverflow, Pagination } from 'swiper/modules';
  import dayjs from 'dayjs';
  import ListView from './ListView.vue';
  import { ref, watch, computed } from 'vue';
  import { usePlanerStore } from '@/stores/planStore';
  const modules = [EffectCoverflow, Pagination];

  import {
    quarterRange,
    monthRange,
    weekRange,
    dayRange,
    overlapsRange,
    countRuleOccurrences,
    getRepository,
    type Task,
  } from '@/api';
  import { getWeekDateRange, countWorkdaysInWeek, getDayTypeInfo } from '@/utils/holiday';

  const planStore = usePlanerStore();
  // 用 getSlideCount() 计算初始 slide 数
  const slideCount = ref(planStore.getSlideCount());
  const activeIndex = ref(planStore.dayActiveIndex);

  const key = ref(`${planStore.cycleValue}-${planStore.year}`);

  // 当前视图数据（store 为唯一数据源，直接响应式引用）
  const currentData = computed<Task[]>(() => planStore.currentData);

  /**
   * 各任务已完成番茄数映射（taskId → count）。
   * 日视图渲染的任务除本级（dayData 已含 finished_pomodoro）外，还并入上级的循环任务
   * （quarter/month/week 数据未附 finished_pomodoro）。这里统一按 pomodoro_records 统计，
   * 供日视图 TaskListItem 判断「已完成数 < 设定配额」时正确显示播放按钮。
   */
  const finishedCountMap = ref<Record<string, number>>({});
  watch(
    () => [
      planStore.cycleValue,
      planStore.quarterData,
      planStore.monthData,
      planStore.weekData,
      planStore.dayData,
    ],
    async () => {
      if (planStore.cycleValue !== 4) return;
      const ids = [
        ...planStore.quarterData,
        ...planStore.monthData,
        ...planStore.weekData,
        ...planStore.dayData,
      ]
        .map(t => t.id)
        .filter((v, i, a) => a.indexOf(v) === i);
      const counts = await getRepository().countCompletedPomodoros(ids);
      finishedCountMap.value = counts;
    },
    { immediate: true }
  );

  // ---- 变更标志 → 自动刷新（按需加载，避免全量重拉导致界面重构）----
  watch(
    () => [
      planStore.isQuarterDataChanged,
      planStore.isMonthDataChanged,
      planStore.isWeekDataChanged,
      planStore.isDayDataChanged,
    ],
    async () => {
      const q = planStore.isQuarterDataChanged;
      const m = planStore.isMonthDataChanged;
      const w = planStore.isWeekDataChanged;
      const d = planStore.isDayDataChanged;
      if (!(q || m || w || d)) return;
      try {
        if (q && m && w && d) {
          // 删除等跨级操作同时置位四个标志 → 全量刷新保证下级一致
          await planStore.refreshAll();
        } else {
          // 单层增改/改循环规则：只重载被标记的层级
          const need: number[] = [];
          if (q) need.push(1);
          if (m) need.push(2);
          if (w) need.push(3);
          if (d) need.push(4);
          // 保证当前视图层级始终刷新（子视图并入的上级循环任务也依赖其数据）
          if (!need.includes(planStore.cycleValue)) need.push(planStore.cycleValue);
          await planStore.refreshSelected(need);
        }
      } finally {
        planStore.isQuarterDataChanged = false;
        planStore.isMonthDataChanged = false;
        planStore.isWeekDataChanged = false;
        planStore.isDayDataChanged = false;
      }
    }
  );

  const slideDateArray = computed(() => {
    switch (planStore.cycleValue) {
      case 1:
        return Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}-第${i + 1}季度`;
        });
      case 2:
        return Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${(planStore.quarter - 1) * 3 + i + 1}月`;
        });
      case 3:
        return Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${planStore.month}月-第${i + 1}周`;
        });
      case 4:
        return Array.from({ length: slideCount.value }, (_, i) => {
          return dayjs(
            `${planStore.year}-${planStore.month}-${(planStore.weekViewIndex - 1) * 7 + i + 1}`
          ).format('YYYY-MM-DD');
        });
      default:
        return [];
    }
  });

  const monthArray = ref<number[]>([1, 2, 3]);

  // 每个 slide 的附加信息（与 slideDateArray 一一对应）
  interface SlideMeta {
    dateRange?: string;
    workdayCount?: number;
    dayType?: 'workday' | 'restday';
    daySubLabel?: string;
  }

  const slideMetaArray = computed<SlideMeta[]>(() => {
    switch (planStore.cycleValue) {
      case 3: {
        return Array.from({ length: slideCount.value }, (_, i): SlideMeta => {
          const weekIndex = i + 1;
          const range = getWeekDateRange(planStore.year, planStore.month, weekIndex);
          const workdayCount = countWorkdaysInWeek(planStore.year, planStore.month, weekIndex);
          return {
            dateRange: range.text,
            workdayCount,
          };
        });
      }
      case 4: {
        return Array.from({ length: slideCount.value }, (_, i): SlideMeta => {
          const info = getDayTypeInfo(slideDateArray.value[i]);
          return {
            dayType: info.type,
            daySubLabel: info.subLabel,
          };
        });
      }
      default:
        return [];
    }
  });

  watch(
    () => planStore.cycleValue,
    () => {
      slideCount.value = planStore.getSlideCount();
      key.value = `${planStore.cycleValue}-${planStore.year}`;
    }
  );

  planStore.$subscribe((_, state) => {
    slideCount.value = planStore.getSlideCount();
    key.value = `${state.cycleValue}-${state.year}`;
    switch (planStore.cycleValue) {
      case 1:
        activeIndex.value = planStore.quarterActiveIndex;
        break;
      case 2:
        activeIndex.value = planStore.monthActiveIndex;
        monthArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return (planStore.quarter - 1) * 3 + i + 1;
        });
        break;
      case 3:
        activeIndex.value = planStore.weekActiveIndex;
        break;
      case 4:
        activeIndex.value = planStore.dayActiveIndex;
        break;
    }
  });

  function onSlideChange(swiper: any) {
    switch (planStore.cycleValue) {
      case 1:
        planStore.$patch({
          quarter: swiper.activeIndex + 1,
          month: swiper.activeIndex * 3 + 1,
          weekViewIndex: 1,
          dayViewIndex: 1,
          quarterActiveIndex: swiper.activeIndex,
          monthActiveIndex: 0,
          weekActiveIndex: 0,
          dayActiveIndex: 0,
        });
        break;
      case 2:
        planStore.$patch({
          month: (planStore.quarter - 1) * 3 + swiper.activeIndex + 1,
          weekViewIndex: 1,
          dayViewIndex: 1,
          monthActiveIndex: swiper.activeIndex,
          weekActiveIndex: 0,
          dayActiveIndex: 0,
        });
        break;
      case 3:
        planStore.$patch({
          weekViewIndex: swiper.activeIndex + 1,
          dayViewIndex: 1,
          weekActiveIndex: swiper.activeIndex,
          dayActiveIndex: 0,
        });
        break;
      case 4:
        planStore.$patch({
          dayViewIndex: swiper.activeIndex + 1,
          dayActiveIndex: swiper.activeIndex,
        });
        break;
    }
  }

  // 根据滑块 n 与日期筛出当前 slide 的任务
  // 子视图（月/周/日）除了本级任务，还按循环规则并入「所有上级」的循环任务：
  // 月←季；周←季、月；日←季、月、周。仅取在该区间内循环规则有触发的上级循环任务。
  function cyclicParentTasks(range: { start: string; end: string }): Task[] {
    // 当前周期类型对应的所有上级任务数据（粒度由小到大）
    const ancestors: Task[][] =
      planStore.cycleValue === 2
        ? [planStore.quarterData]
        : planStore.cycleValue === 3
          ? [planStore.quarterData, planStore.monthData]
          : planStore.cycleValue === 4
            ? [planStore.quarterData, planStore.monthData, planStore.weekData]
            : [];
    return ancestors
      .flat()
      .filter(
        t =>
          t.is_cyclic &&
          t.cycle_rule &&
          countRuleOccurrences(t.cycle_rule, range.start, range.end) > 0
      );
  }

  const filteredTaskData = computed(() => (n: number, date: string) => {
    let own: Task[] = [];
    let inherited: Task[] = [];
    switch (planStore.cycleValue) {
      case 1:
        own = currentData.value.filter(item =>
          overlapsRange(item, quarterRange(planStore.year, n))
        );
        break;
      case 2:
        own = currentData.value.filter(item =>
          overlapsRange(item, monthRange(planStore.year, monthArray.value[n - 1]))
        );
        inherited = cyclicParentTasks(monthRange(planStore.year, monthArray.value[n - 1]));
        break;
      case 3:
        own = currentData.value.filter(item =>
          overlapsRange(item, weekRange(planStore.year, planStore.month, n))
        );
        inherited = cyclicParentTasks(weekRange(planStore.year, planStore.month, n));
        break;
      case 4:
        own = currentData.value.filter(item => overlapsRange(item, dayRange(date)));
        inherited = cyclicParentTasks(dayRange(date));
        break;
      default:
        own = currentData.value.filter(item =>
          overlapsRange(item, quarterRange(planStore.year, n))
        );
        break;
    }
    return [...own, ...inherited].map(t => ({
      ...t,
      // 补充已完成番茄数：合并进来的上级循环任务无 finished_pomodoro，统一从映射补齐
      finished_pomodoro: finishedCountMap.value[t.id] ?? (t as any).finished_pomodoro ?? 0,
    }));
  });
</script>

<template>
  <swiper
    :initialSlide="activeIndex"
    :key="key"
    :run-callbacks-on-init="false"
    :centeredSlides="true"
    :effect="'coverflow'"
    :grabCursor="true"
    :slidesPerView="'auto'"
    :coverflowEffect="{
      rotate: 0,
      stretch: 50,
      depth: 100,
      modifier: 1,
      scale: 0.9,
      slideShadows: false,
    }"
    :modules="modules"
    class="mySwiper"
    style="flex: 1"
    @slideChange="onSlideChange"
  >
    <swiper-slide
      v-for="n in slideCount"
      :key="n"
      style="background-color: white"
      :class="{ 'disabled-area': activeIndex !== n - 1 }"
    >
      <ListView
        :slideDate="slideDateArray[n - 1]"
        :taskData="filteredTaskData(n, slideDateArray[n - 1])"
        :dateRange="slideMetaArray[n - 1]?.dateRange"
        :workdayCount="slideMetaArray[n - 1]?.workdayCount"
        :dayType="slideMetaArray[n - 1]?.dayType"
        :daySubLabel="slideMetaArray[n - 1]?.daySubLabel"
      />
    </swiper-slide>
  </swiper>
</template>

<style>
  .swiper {
    width: 100%;
    padding-top: 50px;
    padding-bottom: 50px;
  }

  .swiper-slide {
    background-position: center;
    background-size: cover;
    width: 400px;
    height: 650px;
    border-radius: 15px;
    box-shadow: 0 0 20px 5px rgba(173, 216, 230, 0.5);
  }

  .swiper-slide img {
    display: block;
    width: 100%;
  }

  .disabled-area {
    pointer-events: none;
    opacity: 0.5;
  }
</style>
