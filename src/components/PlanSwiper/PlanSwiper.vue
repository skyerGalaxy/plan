
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

import {watch, ref } from 'vue';

const modules = [EffectCoverflow, Pagination];
const props = defineProps({
  slideCount: {
    type: Number,
    required:true,
  },
  initIndex:{
    type:Number,
    default:0
  }
});

//control rebuild swiper
const swiperKey = ref(`${props.slideCount}-${props.initIndex}`);
watch([() => props.slideCount, () => props.initIndex], () => {
  swiperKey.value = `${props.slideCount}-${props.initIndex}`;
});

//mark slide when swiper change
const activeSlideIndex = ref(props.initIndex);
const onSlideChange = (swiper: any) => {
  activeSlideIndex.value = swiper.activeIndex;
};                     
</script>

<template>
    <swiper
      :key="swiperKey"
      :initialSlide="initIndex"
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
      <swiper-slide v-for="n in slideCount" :key="n" style="background-color: white; "  :class="{'disabled-area': activeSlideIndex !== n-1}" >
        <ListView />
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


