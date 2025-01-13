
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
import {ref } from 'vue';
import { usePlanerStore } from '@/stores/planStore';
const modules = [EffectCoverflow, Pagination];

const planStore = usePlanerStore();
const slideCount = ref(planStore.slideCount);
const activeIndex = ref(planStore.dayViewIndex-1);
const quarterIndex = ref<number>(planStore.quarter - 1);
const monthIndex = ref<number>(planStore.month-(planStore.quarter-1)*3 - 1);
const weekIndex = ref<number>(planStore.weekViewIndex - 1);
const dayIndex = ref<number>(planStore.dayViewIndex - 1);

const key = ref("${planStore.cycleValue}-${planStore.year}");

const data = ref();
const slideDateArray = ref<string[]>(Array.from({ length: slideCount.value }, (_, i) => {
  return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex-1)*7+i+1}`).format('YYYY-MM-DD');
}));



planStore.$subscribe((_, state) => {
  slideCount.value = planStore.getSlideCount();
  switch (state.cycleValue) {
    case 1:
      activeIndex.value = quarterIndex.value;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}-第${i+1}季度`;
      });
      break;
    case 2:
      activeIndex.value = monthIndex.value;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}年-${(planStore.quarter-1)*3+i+1}月`;
      });
      break;
    case 3:
      activeIndex.value = weekIndex.value;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}年-${state.month}月-第${i+1}周`;
      });
      break;
    case 4:
      activeIndex.value = dayIndex.value;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return dayjs(`${planStore.year}-${planStore.month}-${(planStore.weekViewIndex-1)*7+i+1}`).format('YYYY-MM-DD');
      });
      break;
  }
  key.value = `${state.cycleValue}-${state.year}`;
});

function onSlideChange(swiper: any) {
  switch (planStore.cycleValue) {
    case 1:
      planStore.quarter = swiper.activeIndex + 1;
      planStore.month = (swiper.activeIndex)*3 + 1;
      planStore.weekViewIndex = 1;
      planStore.dayViewIndex = 1;
      quarterIndex.value = swiper.activeIndex;
      monthIndex.value = 0;
      weekIndex.value = 0;
      dayIndex.value = 0;
      break;
    case 2:
      planStore.month = (planStore.quarter-1)*3+swiper.activeIndex + 1;
      planStore.weekViewIndex = 1;
      planStore.dayViewIndex = 1;
      monthIndex.value = swiper.activeIndex;
      weekIndex.value = 0;
      dayIndex.value = 0;
      break;
    case 3:
      planStore.weekViewIndex = swiper.activeIndex + 1;
      planStore.dayViewIndex = 1;
      weekIndex.value = swiper.activeIndex;
      dayIndex.value = 0;
      break;
    case 4:
      planStore.dayViewIndex = swiper.activeIndex + 1;
      dayIndex.value = swiper.activeIndex;
      break;
  }
}               
</script>

<template>
    <swiper
      :key="key"
      :initialSlide="activeIndex"
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


