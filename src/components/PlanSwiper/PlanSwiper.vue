<script setup lang="ts">
  import { Swiper, SwiperSlide } from 'swiper/vue';
  import 'swiper/css';
  import 'swiper/css/effect-coverflow';
  import 'swiper/css/pagination';
  import './style.css';
  import { EffectCoverflow, Pagination } from 'swiper/modules';
  import dayjs from 'dayjs';
  import ListView from './ListView.vue';
  import { ref, watch, computed } from 'vue';
  import { usePlanerStore } from '@/stores/planStore';
  const modules = [EffectCoverflow, Pagination];

  import {
    getTaskFromQuarter,
    getTaskFromMonth,
    getTaskFromWeek,
    getTaskFromDay,
  } from '@/utils/supabaseFunction';

  const planStore = usePlanerStore();
  const slideCount = ref(planStore.slideCount);
  const activeIndex = ref(planStore.dayActiveIndex);

  const key = ref(`${planStore.cycleValue}-${planStore.year}`);

  const taskData = ref<any[]>(planStore.dayData);
  const quarterData = ref<any[]>(planStore.quarterData);
  const monthData = ref<any[]>(planStore.monthData);
  const weekData = ref<any[]>(planStore.weekData);
  const dayData = ref<any[]>(planStore.dayData);

  const quarterChange = ref(false);
  const monthChange = ref(false);
  const weekChange = ref(false);
  const dayChange = ref(false);

  const slideDateArray = ref<string[]>(
    Array.from({ length: slideCount.value }, (_, i) => {
      return dayjs(
        `${planStore.year}-${planStore.month}-${(planStore.weekViewIndex - 1) * 7 + i + 1}`
      ).format('YYYY-MM-DD');
    })
  );

  const monthArray = ref<number[]>([1, 2, 3]);

  const isLoading = ref(false);

  watch(
    () => planStore.cycleValue,
    async (newValue, oldValue) => {
      if (newValue !== oldValue) {
        isLoading.value = true;
        switch (planStore.cycleValue) {
          case 1:
            if (planStore.yearChange == false && planStore.isQuarterDataChanged == false) {
              taskData.value = quarterData.value;
              console.log('local', taskData.value);
            } else {
              const quarterResult = await getTaskFromQuarter(planStore.year);
              taskData.value = quarterResult;
              quarterData.value = quarterResult;
              planStore.yearChange = false;
              planStore.isQuarterDataChanged = false;
            }
            break;
          case 2:
            if (
              planStore.yearChange == false &&
              quarterChange.value == false &&
              planStore.isMonthDataChanged == false
            ) {
              taskData.value = monthData.value;
              console.log('local', taskData.value);
            } else {
              const monthResult = await getTaskFromMonth(planStore.year, planStore.quarter);
              taskData.value = monthResult;
              monthData.value = monthResult;
              planStore.yearChange = false;
              quarterChange.value = false;
              planStore.isMonthDataChanged = false;
            }
            break;
          case 3:
            if (
              planStore.yearChange == false &&
              quarterChange.value == false &&
              monthChange.value == false &&
              planStore.isWeekDataChanged == false
            ) {
              taskData.value = weekData.value;
              console.log('local', taskData.value);
            } else {
              const result = await getTaskFromWeek(planStore.year, planStore.month);
              taskData.value = result;
              weekData.value = result;
              planStore.yearChange = false;
              quarterChange.value = false;
              monthChange.value = false;
              planStore.isWeekDataChanged = false;
            }
            break;
          case 4:
            if (
              planStore.yearChange == false &&
              quarterChange.value == false &&
              monthChange.value == false &&
              weekChange.value == false &&
              planStore.isDayDataChanged == false
            ) {
              taskData.value = dayData.value;
              console.log('local', taskData.value);
            } else {
              const result = await getTaskFromDay(
                planStore.year,
                planStore.month,
                planStore.weekViewIndex
              );
              taskData.value = result;
              dayData.value = result;
              planStore.yearChange = false;
              quarterChange.value = false;
              monthChange.value = false;
              weekChange.value = false;
              planStore.isDayDataChanged = false;
            }
            break;
        }
        isLoading.value = false;
      }
    }
  );

  planStore.$subscribe(async (_, state) => {
    slideCount.value = planStore.getSlideCount();
    key.value = `${state.cycleValue}-${state.year}`;
    switch (planStore.cycleValue) {
      case 1:
        activeIndex.value = planStore.quarterActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}-第${i + 1}季度`;
        });
        break;
      case 2:
        activeIndex.value = planStore.monthActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${(planStore.quarter - 1) * 3 + i + 1}月`;
        });
        monthArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return (planStore.quarter - 1) * 3 + i + 1;
        });
        break;
      case 3:
        activeIndex.value = planStore.weekActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${planStore.month}月-第${i + 1}周`;
        });
        break;
      case 4:
        activeIndex.value = planStore.dayActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return dayjs(
            `${planStore.year}-${planStore.month}-${(planStore.weekViewIndex - 1) * 7 + i + 1}`
          ).format('YYYY-MM-DD');
        });
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
        quarterChange.value = true;
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
        monthChange.value = true;
        break;
      case 3:
        planStore.$patch({
          weekViewIndex: swiper.activeIndex + 1,
          dayViewIndex: 1,
          weekActiveIndex: swiper.activeIndex,
          dayActiveIndex: 0,
        });
        weekChange.value = true;
        break;
      case 4:
        planStore.$patch({
          dayViewIndex: swiper.activeIndex + 1,
          dayActiveIndex: swiper.activeIndex,
        });
        dayChange.value = true;
        break;
    }
  }

  const filteredTaskData = computed(() => (n: number, date: string) => {
    switch (planStore.cycleValue) {
      case 1:
        return taskData.value.filter((item: any) => item.quarter === n);
      case 2:
        return taskData.value.filter((item: any) => item.month === monthArray.value[n - 1]);
      case 3:
        return taskData.value.filter((item: any) => item.week === n);
      case 4:
        return taskData.value.filter((item: any) => dayjs(item.day).format('YYYY-MM-DD') === date);
      default:
        return [];
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
      />
    </swiper-slide>
  </swiper>
</template>

<style>
  .disabled-area {
    pointer-events: none;
    opacity: 0.5;
  }
</style>
