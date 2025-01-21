
<script setup lang="ts">
// Import Swiper Vue.js components
import { Swiper, SwiperSlide } from 'swiper/vue';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import './style.css';
// import required modules
import { EffectCoverflow, Pagination } from 'swiper/modules';
import dayjs from 'dayjs';
import ListView from './ListView.vue';
import {ref,watch} from 'vue';
import { usePlanerStore } from '@/stores/planStore';
const modules = [EffectCoverflow, Pagination];

import { getTaskFromQuarter,getTaskFromMonth,getTaskFromWeek,getTaskFromDay } from '@/utils/supabaseFunction';

const planStore = usePlanerStore();
const slideCount = ref(planStore.slideCount);
const activeIndex = ref(planStore.dayActiveIndex);

const key = ref("${planStore.cycleValue}-${planStore.year}");

const data = ref<any[]>(planStore.dayData);
const slideDateArray = ref<string[]>(Array.from({ length: slideCount.value }, (_, i) => {
  return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex-1)*7+i+1}`).format('YYYY-MM-DD');
}));

watch(() => planStore.cycleValue, async (newValue, oldValue) => {
  if (newValue !== oldValue) {
    console.log("Retrieve data");
    switch (planStore.cycleValue) {
      case 1:
        data.value =await getTaskFromQuarter(planStore.year);
        break;
      case 2:
        data.value =await getTaskFromMonth(planStore.year,planStore.quarter);
        break;
      case 3:
        data.value =await getTaskFromWeek(planStore.year,planStore.month);
        break;
      case 4:
        data.value =await getTaskFromDay(planStore.year,planStore.month,planStore.weekViewIndex);
        break;
    }
  }
});

planStore.$subscribe(async(_, state) => {
  slideCount.value = planStore.getSlideCount();
  key.value = `${state.cycleValue}-${state.year}`;
  switch (planStore.cycleValue) {
      case 1:
        activeIndex.value = planStore.quarterActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}-第${i+1}季度`;
        });
        break;
      case 2:
        activeIndex.value = planStore.monthActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${(planStore.quarter-1)*3+i+1}月`;
        });
        break;
      case 3:
        activeIndex.value = planStore.weekActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return `${planStore.year}年-${planStore.month}月-第${i+1}周`;
        });
        break;
      case 4:
        activeIndex.value = planStore.dayActiveIndex;
        slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
          return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex-1)*7+i+1}`).format('YYYY-MM-DD');
        });
        break;
    }
});

function onSlideChange(swiper: any) {
  switch (planStore.cycleValue) {
    case 1:
      planStore.$patch({
        quarter: swiper.activeIndex + 1,
        month: (swiper.activeIndex)*3 + 1,
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
        month: (planStore.quarter-1)*3+swiper.activeIndex + 1,
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
</script>

<template>
    <swiper
      :initialSlide="activeIndex"
      :key = key
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
      <swiper-slide v-for="n in slideCount" :key="n" style="background-color: white; "  :class="{'disabled-area': activeIndex !== n-1}" >
        <ListView :slideDate="slideDateArray[n-1]"/>
      </swiper-slide>
    </swiper>
</template>

<style>
  .disabled-area {
    pointer-events: none;
    /* 使该区域不可交互 */
    opacity: 0.5; /* 可选，降低透明度来让用户知道该区域不可用 */
  }
</style>

