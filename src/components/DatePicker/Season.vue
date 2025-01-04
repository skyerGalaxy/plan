<template>
      <a-date-picker v-model:value="year" picker="year" />
</template>
<script lang="ts" setup>
import { watch } from 'vue';
import { ref } from 'vue';
import { usePlanerStore } from '@/stores/planStore';

const year = ref<number>();
const planStore = usePlanerStore();
watch(year, (newVal) => {
      if (newVal !== undefined) {
            planStore.year = newVal;
      }

      //request new data from season table according to the year
      //write the data to planStore
});
</script>

  