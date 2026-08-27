<script setup lang="ts">
  import { usePlanerStore } from '@/stores/planStore';
  const planStore = usePlanerStore();
</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-content style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
        <div v-if="planStore.dayData.length > 0">
          <h1>Fetched Data:</h1>
          <pre>{{ planStore.dayData }}</pre>
          <h2>First Plan:</h2>
          <pre>{{ planStore.dayData[0] }}</pre>
        </div>
        <div v-else>
          <h3>No Data Fetched</h3>
        </div>
    </a-layout-content>
  </a-layout>
</template>