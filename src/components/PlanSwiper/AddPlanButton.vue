<script lang="ts" setup>
import { ref } from 'vue';
import addLightImage from '@/assets/add_light.svg';
import { usePlanerStore } from '@/stores/planStore';
const modalVisible = ref<boolean>(false);

const planStore = usePlanerStore();
const setModal1Visible = (open: boolean) => {
  modalVisible.value = open;
};
</script>


<template>
    <div id="components-modal-demo-position">
      <button @click="modalVisible = true" style="background: none; border: none; padding: 0; cursor: pointer;">
        <img :src="addLightImage" alt="Add Plan" style="width: 20px; height: 20px;" />
      </button>
      <a-modal
        v-model:open="modalVisible"
        title="Vertically centered modal dialog"
        centered
        @ok="modalVisible = false"
      >
        <p>{{ planStore.quarter }}</p>
      </a-modal>
    </div>
  </template>

  