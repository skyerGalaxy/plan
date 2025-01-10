
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
import ListView from './ListView.vue';
import {ref } from 'vue';
import { usePlanerStore } from '@/stores/planStore';
const modules = [EffectCoverflow, Pagination];

const planStore = usePlanerStore();
const slideCount = ref(planStore.slideCount);
const activeIndex = ref(planStore.dayViewIndex-1);

const key = ref("${planStore.cycleValue}-${planStore.year}");

const data = ref();
const slideDateArray = ref<string[]>(Array.from({ length: slideCount.value }, (_, i) => {
  return `${planStore.year}年-${planStore.month}月-${(planStore.weekViewIndex-1)*7+i+1}日`;
}));



planStore.$subscribe((_, state) => {
  slideCount.value = planStore.getSlideCount();
  switch (state.cycleValue) {
    case 1:
      activeIndex.value = state.quarter - 1;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}-第${i+1}季度`;
      });
      break;
    case 2:
      activeIndex.value = state.month-(planStore.quarter-1)*3 - 1;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}年-${(planStore.quarter-1)*3+i+1}月`;
      });
      break;
    case 3:
      activeIndex.value = state.weekViewIndex - 1;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}年-${state.month}月-第${i+1}周`;
      });
      break;
    case 4:
      activeIndex.value = state.dayViewIndex - 1;
      slideDateArray.value = Array.from({ length: slideCount.value }, (_, i) => {
        return `${state.year}年-${state.month}月-${(state.weekViewIndex-1)*7+i+1}日`;
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
      break;
    case 2:
      planStore.month = (planStore.quarter-1)*3+swiper.activeIndex + 1;
      planStore.weekViewIndex = 1;
      planStore.dayViewIndex = 1;
      break;
    case 3:
      planStore.weekViewIndex = swiper.activeIndex + 1;
      planStore.dayViewIndex = 1;
      break;
    case 4:
      planStore.dayViewIndex = swiper.activeIndex + 1;
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


