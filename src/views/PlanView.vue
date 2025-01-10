<script setup lang="ts">
import { SeasonPicker} from '@/components/DatePicker/dataPicker';
import PlanSwiper from '@/components/PlanSwiper/PlanSwiper.vue';
import HideSwitch from '@/components/HideSwitch.vue';
import { usePlanerStore } from '@/stores/planStore';
import CurrentDate from '@/components/CurrentDate.vue';

const planStore = usePlanerStore();
</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-header style="background: #fff; display: flex; justify-content: space-between; align-items: center;">
      <div style="text-align: center; flex: 1;">
        <SeasonPicker v-show="planStore.cycleValue == 1" style="width: 200px;"/>
      </div>
      <div style="text-align: right;">
        <a-radio-group v-model:value="planStore.cycleValue" button-style="solid">
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
      <PlanSwiper style="flex: 1; overflow-y: auto;"/>
    </a-layout-content>
    <a-layout-footer style="text-align: center; background: #fff;">
      <CurrentDate/>
    </a-layout-footer>
  </a-layout>
</template>