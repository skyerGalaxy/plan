<template>
    <a-switch v-model:checked="checked" />
  </template>
  <script lang="ts" setup>
  import { ref } from 'vue';
  const checked = ref<boolean>(false);
  </script>
  
  