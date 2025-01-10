<script lang="ts" setup>
  import { ref } from 'vue';
  import { usePlanerStore } from '@/stores/planStore';
  const planStore = usePlanerStore();

  const cycle = ref(planStore.cycleValue);
  const year = ref(planStore.year);
  const quarter = ref(planStore.quarter);
  const month = ref(planStore.month);
  const weekIndex = ref(planStore.weekViewIndex);
  const dayIndex =ref(planStore.dayViewIndex);

  planStore.$subscribe((mutation, state) => {
    cycle.value = state.cycleValue;
    year.value = state.year;
    quarter.value = state.quarter;
    month.value = state.month;
    weekIndex.value = state.weekViewIndex;
    dayIndex.value = state.dayViewIndex;
  });

</script>

<template>
  <div v-if="cycle === 1">
    <span class="text-2xl font-semibold">{{ year }}年第{{ quarter }}季度</span>
  </div>
  <div v-else-if="cycle === 2">
    <span class="text-2xl font-semibold">{{ year }}年{{ month }}月</span>
  </div>
  <div v-else-if="cycle === 3" class="flex items-center gap-2">
    <span class="text-2xl font-semibold">{{ year }}年{{ month }}月第{{ weekIndex }}周</span>
  </div>
  <div v-else-if="cycle === 4" class="flex items-center gap-2">
    <span class="text-2xl font-semibold">{{ year }}年{{ month }}月{{ dayIndex }}日</span>
  </div>
</template>



  