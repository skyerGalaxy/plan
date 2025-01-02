<template>
      <a-date-picker v-model:value="year" picker="year" />
</template>
<script lang="ts" setup>
import { ref } from 'vue';
import type { Dayjs } from 'dayjs';
const year = ref<Dayjs>();
</script>

  