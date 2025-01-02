<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { WeekPicker, SeasonPicker, MonthPicker, DayPicker } from '@/components/DatePicker/dataPicker';
import PlanSwiper from '@/components/PlanSwiper/PlanSwiper.vue';
import HideSwitch from '@/components/HideSwitch.vue';
import { weekInMonth } from '@/utils/weekInMonth';
import { daysInMonth } from '@/utils/daysInMonth';
import { currentWeek } from '@/utils/currentWeek';


const cycle = ref<number>(4);
const swiperCount = ref<number>(10);
const activeIndex = ref(0);

const currentComponents = computed(() => {
  switch (cycle.value) {
    case 1:
      return SeasonPicker;
    case 2:
      return MonthPicker;
    case 3:
      return WeekPicker;
    case 4:
      return DayPicker;
    default:
      return DayPicker;
  }
});

watch(cycle, (newVal) => {
  switch (newVal) {
    case 1:
      swiperCount.value=4;
      activeIndex.value=3;
      break;
    case 2:
      swiperCount.value=3;
      activeIndex.value =3;
      break;
    case 3:
      swiperCount.value=weekInMonth();
      activeIndex.value = currentWeek().weekNumber-1;
      break;
    case 4:
      swiperCount.value=daysInMonth();
      activeIndex.value = currentWeek().dayNumber-1;
      break;
  }
});

</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-header style="background: #fff; display: flex; justify-content: space-between; align-items: center;">
      <div style="text-align: center; flex: 1;">
        <component :is="currentComponents"></component>
      </div>
      <div style="text-align: right;">
        <a-radio-group v-model:value="cycle" button-style="solid">
          <a-radio-button :value="1">季</a-radio-button>
          <a-radio-button :value="2">月</a-radio-button>
          <a-radio-button :value="3">周</a-radio-button>
          <a-radio-button :value="4">天</a-radio-button>
        </a-radio-group>
      </div>
    </a-layout-header>
    <a-layout-content style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
      <div style="padding: 24px; display: flex; justify-content: flex-end; align-items: center; gap: 10px;">
        <HideSwitch/>
        <span>隐藏已完成</span>
      </div>
      <PlanSwiper :slideCount="swiperCount" :initIndex="activeIndex" style="flex: 1; overflow-y: auto;"/>
    </a-layout-content>
  </a-layout>
</template>