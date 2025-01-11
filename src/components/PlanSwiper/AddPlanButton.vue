<script lang="ts" setup>
import { ref,defineComponent } from 'vue';
import addLightImage from '@/assets/add_light.svg';
import { Icon } from 'ant-design-vue';
import RangeButton from './RangeButton.vue'; 
import { usePlanerStore } from '@/stores/planStore';

const modalVisible = ref<boolean>(false);
const planStore = usePlanerStore();
const taskValue = ref<string>('');
const isLoop = ref<boolean>(false);
const pomodoroCount = ref<number>(1);
</script>

<template>
  <div id="components-modal-demo-position">
    <button @click="modalVisible = true" style="background: none; border: none; padding: 0; cursor: pointer;">
      <img :src="addLightImage" alt="Add Plan" style="width: 20px; height: 20px;" />
    </button>
    <a-modal
      v-model:open="modalVisible"
      centered
      @ok="modalVisible = false"
    >
      <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 40px;">
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
          <a-input v-model:value="taskValue" placeholder="把事情记下来" />
          <RangeButton/>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <a-checkbox v-model:checked="isLoop">循环</a-checkbox>
          <a-rate v-model:value="pomodoroCount" :count="4">
          </a-rate>
        </div>
        
      </div>
    </a-modal>
  </div>
</template>




