<template>
      <a-date-picker  picker="year" @change ="onDateChange"/>
</template>
<script lang="ts" setup>
import { usePlanerStore } from '@/stores/planStore';
import dayjs from 'dayjs';

// const year = ref<number>();
const planStore = usePlanerStore();

function onDateChange(date: dayjs.Dayjs) {
      planStore.year = date.year();
      planStore.quarter = 1;
      planStore.month = 1;
      planStore.weekViewIndex = 1;
      planStore.dayViewIndex = 1;
      planStore.yearChange = true;
}
</script>

  
  