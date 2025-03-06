<script setup lang="ts">
import { Swiper, SwiperSlide } from 'swiper/vue';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import './style.css';
import { EffectCoverflow, Pagination } from 'swiper/modules';
import dayjs from 'dayjs';
import ListView from './ListView.vue';
import { ref, watch, watchEffect } from 'vue';
import { usePlanerStore } from '@/stores/planStore';
const modules = [EffectCoverflow, Pagination];

import { getTaskFromQuarter, getTaskFromMonth, getTaskFromWeek, getTaskFromDay } from '@/utils/supabaseFunction';

const planStore = usePlanerStore();
const slideCount = ref(planStore.slideCount);
const activeIndex = ref(planStore.dayActiveIndex);

const key = ref(`${planStore.cycleValue}-${planStore.year}`);

const taskData = ref<any[]>([]);
watchEffect(() => {
  taskData.value = planStore.dayData || [];
});
const quarterDate = ref<any[]>(planStore.quarterData);
const monthDate = ref<any[]>(planStore.monthData);
const weekDate = ref<any[]>(planStore.weekData);
const dayDate = ref<any[]>(planStore.dayData);

const quarterChange = ref(false);
const monthChange = ref(false);
const weekChange = ref(false);
const dayChange = ref(false);

const slideDateArray = ref<string[]>(Array.from({ length: slideCount.value }, (_, i) => {
  return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex-1)*7+i+1}`).format('YYYY-MM-DD');
}));

const monthArray = ref<number[]>([1, 2, 3]);

watch(() => planStore.cycleValue, async (newValue, oldValue) => {
  if (newValue !== oldValue) {
    switch (planStore.cycleValue) {
      case 1:
        if (planStore.yearChange == false) {
          taskData.value = quarterDate.value;
        } else {
          taskData.value = await getTaskFromQuarter(planStore.year);
          planStore.yearChange = false;
        }
        break;
      case 2:
        if (planStore.yearChange == false && quarterChange.value == false) {
          taskData.value = monthDate.value;
        } else {
          taskData.value = await getTaskFromMonth(planStore.year, planStore.quarter);
          planStore.yearChange = false;
          quarterChange.value = false;
        }
        break;
      case 3:
        if (planStore.yearChange == false && quarterChange.value == false && monthChange.value == false) {
          taskData.value = weekDate.value;
        } else {
          taskData.value = await getTaskFromWeek(planStore.year, planStore.month);
          planStore.yearChange = false;
          quarterChange.value = false;
          monthChange.value = false;
        }
        break;
      case 4:
        if (planStore.yearChange == false && quarterChange.value == false && monthChange.value == false && weekChange.value == false) {
          taskData.value = dayDate.value;
        } else {
          taskData.value = await getTaskFromDay(planStore.year, planStore.month, planStore.weekViewIndex);
          planStore.yearChange = false;
          quarterChange.value = false;
          monthChange.value = false;
          weekChange.value = false;
        }
        break;
    }
    console.log(taskData.value);
  }
});

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
        return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex - 1) * 7 + i + 1}`).format('YYYY-MM-DD');
      });
      break;
  }
});

function onSlideChange(swiper: any) {
  switch (planStore.cycleValue) {
    case 1:
      planStore.$patch({
        quarter: swiper.activeIndex + 1,
        month: (swiper.activeIndex) * 3 + 1,
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
      slideShadows: false
    }"
    :modules="modules"
    class="mySwiper"
    style="flex: 1;"
    @slideChange="onSlideChange"
  >
    <swiper-slide v-for="n in slideCount" :key="n" style="background-color: white;" :class="{'disabled-area': activeIndex !== n-1}">
      <ListView 
        :slideDate="slideDateArray[n-1]" 
        :taskData="taskData.filter((item: any) => dayjs(item.day).format('YYYY-MM-DD')===slideDateArray[n-1])"
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