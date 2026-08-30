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

  import { quarterRange, monthRange, weekRange, dayRange, overlapsRange, type Task } from '@/api';
  import { getWeekDateRange, countWorkdaysInWeek, getDayTypeInfo } from '@/utils/holiday';

  const planStore = usePlanerStore();
  // 用 getSlideCount() 计算初始 slide 数
  const slideCount = ref(planStore.getSlideCount());
  const activeIndex = ref(planStore.dayActiveIndex);

  const key = ref(`${planStore.cycleValue}-${planStore.year}`);

  const isLoading = ref(false);

  // 当前视图数据（store 为唯一数据源，直接响应式引用）
  const currentData = computed<Task[]>(() => planStore.currentData);

  // ---- 变更标志 → 自动刷新当前视图 ----
  watch(
    () => [
      planStore.isQuarterDataChanged,
      planStore.isMonthDataChanged,
      planStore.isWeekDataChanged,
      planStore.isDayDataChanged,
    ],
    async ([q, m, w, d]) => {
      const changed =
        (planStore.cycleValue === 1 && q) ||
        (planStore.cycleValue === 2 && (q || m)) ||
        (planStore.cycleValue === 3 && (q || m || w)) ||
        (planStore.cycleValue === 4 && (q || m || w || d));
      if (!changed) return;
      isLoading.value = true;
      try {
        await planStore.refreshCurrent();
      } finally {
        isLoading.value = false;
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

  watch(() => planStore.cycleValue, () => {
    slideCount.value = planStore.getSlideCount();
    key.value = `${planStore.cycleValue}-${planStore.year}`;
  });

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
  const filteredTaskData = computed(() => (n: number, date: string) => {
    switch (planStore.cycleValue) {
      case 1:
        return currentData.value.filter((item: Task) =>
          overlapsRange(item, quarterRange(planStore.year, n))
        );
      case 2:
        return currentData.value.filter((item: Task) =>
          overlapsRange(item, monthRange(planStore.year, monthArray.value[n - 1]))
        );
      case 3:
        return currentData.value.filter((item: Task) =>
          overlapsRange(item, weekRange(planStore.year, planStore.month, n))
        );
      case 4:
        return currentData.value.filter((item: Task) => overlapsRange(item, dayRange(date)));
      default:
        return currentData.value.filter((item: Task) =>
          overlapsRange(item, quarterRange(planStore.year, n))
        );
    }
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
        v-if="!isLoading"
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
