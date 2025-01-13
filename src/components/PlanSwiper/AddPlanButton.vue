<script lang="ts" setup>
import { ref,defineProps} from 'vue';
import dayjs from 'dayjs';

import addLightImage from '@/assets/add_light.svg';
import WhiteTomatoIcon from "@/assets/white_clock.svg";
import ColorTomatoIcon from "@/assets/red_clock.svg";

import RangeButton from './RangeButton.vue'; 

import { usePlanerStore } from '@/stores/planStore';

defineProps({
  slideDate:String 
})



const modalVisible = ref<boolean>(false);
const planStore = usePlanerStore();
const taskValue = ref<string>('');
const rangeValue= ref<number>(1);
const isLoop = ref<boolean>(false);
const pomodoroCount = ref<number>(0);//current pomodoro count
const hoverIndex = ref(0); // mouse hover index
const whiteIcon = WhiteTomatoIcon;
const coloredIcon = ColorTomatoIcon;

//get rangeValue from RangeButton.vue(child component)
function getRangeValue(value:number){
  rangeValue.value = value;
  console.log(rangeValue.value);
}
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
        <RangeButton @updateRangeValue="getRangeValue" />
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <a-checkbox v-model:checked="isLoop">循环</a-checkbox>
        <div class="rate-container">
          <div
            v-for="index in 4"
            :key="index"
            class="rate-item"
            @click="pomodoroCount = index"
            @mouseenter="hoverIndex = index"
            @mouseleave="hoverIndex = 0"
          >
            <img
              :src="index <= (hoverIndex || pomodoroCount) ? coloredIcon : whiteIcon"
              class="tomato-icon"
            />
          </div>
        </div>
      </div>
    </div>
    </a-modal>
  </div>
</template>


<style scoped>
.rate-container {
  display: flex;
  gap: 8px;
}
.tomato-icon {
  width: 22px;
  height: 22px;
  cursor: pointer;
}
</style>

