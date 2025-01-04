<script setup lang="ts">
import { ref, watch } from 'vue';
import { SeasonPicker} from '@/components/DatePicker/dataPicker';
import PlanSwiper from '@/components/PlanSwiper/PlanSwiper.vue';
import HideSwitch from '@/components/HideSwitch.vue';
import { usePlanerStore } from '@/stores/planStore';

const planStore = usePlanerStore();
const cycleValue = ref<number>(4);

const swiperCount = ref(planStore.daysOfWeek);
const activeIndex = ref(planStore.daysInWeek-1);



watch(cycleValue, (newVal) => {
  //根据不同的cycleValue值，根据planStore中的相应日期请求相应的数据
  //根据planStore中的数据，计算swiperCount的值
  switch (newVal) {
    case 1:
      swiperCount.value = 4;
      activeIndex.value = 0;
      break;
    case 2:
      swiperCount.value = 3;
      activeIndex.value = 0;
      break;
    case 3:
      swiperCount.value = planStore.weeksOfMonth;
      activeIndex.value = planStore.weekInMonth-1;
      break;
    case 4:
      swiperCount.value = planStore.daysOfWeek;
      activeIndex.value = planStore.daysInWeek-1;
      break;
  }
});

planStore.$subscribe((mutation,state) => {
  console.log(mutation,state);
});

</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-header style="background: #fff; display: flex; justify-content: space-between; align-items: center;">
      <div style="text-align: center; flex: 1;">
        <SeasonPicker v-show="cycleValue == 1" style="width: 200px;"/>
      </div>
      <div style="text-align: right;">
        <a-radio-group v-model:value="cycleValue" button-style="solid">
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