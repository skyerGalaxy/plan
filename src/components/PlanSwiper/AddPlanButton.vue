<script lang="ts" setup>
import { ref,defineProps} from 'vue';
import dayjs from 'dayjs';

import addLightImage from '@/assets/add_light.svg';
import WhiteTomatoIcon from "@/assets/white_clock.svg";
import ColorTomatoIcon from "@/assets/red_clock.svg";

import { DownOutlined } from '@ant-design/icons-vue';



import RangeButton from './RangeButton.vue'; 

import { usePlanerStore } from '@/stores/planStore';



defineProps({
  slideDate:String 
})

const planStore = usePlanerStore();

const modalVisible = ref<boolean>(false);
const taskValue = ref<string>('');
const rangeValue= ref<number>(1);
const isLoop = ref<boolean>(false);
const pomodoroCount = ref<number>(0);//current pomodoro count
const hoverIndex = ref(0); // mouse hover index
const whiteIcon = WhiteTomatoIcon;
const coloredIcon = ColorTomatoIcon;
const parentTaskText = ref<string>('选择父任务');


function handleMenuClick(e: { key: string; domEvent: Event }) {
  const text = (e.domEvent.target as HTMLElement).textContent;
  parentTaskText.value = text || '';
}

function modelCancel(){
  modalVisible.value = false;
  taskValue.value = '';
  planStore.taskRangeIndex = 1;
  planStore.taskRangeInfo = {label: "重要且紧急", value: 1, class: "priority-urgent-important", symbol: "Ⅰ" };
  isLoop.value = false;
  pomodoroCount.value = 0;
  parentTaskText.value = '选择父任务';
}

function modelOk(){
  //submit the plan to supabase
  // then reset the modal,
  // and insert the plan to the plan list
}
</script>

<template>
  <div id="components-modal-demo-position">
    <button @click="modalVisible = true;" style="background: none; border: none; padding: 0; cursor: pointer;">
      <img :src="addLightImage" alt="Add Plan" style="width: 20px; height: 20px;" />
    </button>
    <a-modal
      v-model:open="modalVisible"
      centered
      @cancel="modelCancel"
      @ok="modalVisible = false"
    >
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 40px;">
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        <a-input v-model:value="taskValue" placeholder="把事情记下来" />
        <RangeButton />
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <a-checkbox v-model:checked="isLoop" v-if="planStore.cycleValue!==4">循环</a-checkbox>
        <a-dropdown v-if="planStore.cycleValue!==1">
          <template #overlay>
            <a-menu @click="handleMenuClick">
              <a-menu-item key="1">
                1st menu item
              </a-menu-item>
              <a-menu-item key="2">
                444444444444444444444444444444
              </a-menu-item>
              <a-menu-item key="3">
                3rd item
              </a-menu-item>
            </a-menu>
          </template>
          <a-button class = "parent-task-button">
            <span class="parent-task-value">{{ parentTaskText }}</span>
            <DownOutlined :style="{ 'padding-top': '5px' }"/>
          </a-button>
        </a-dropdown>
        <div class="rate-container" v-if="planStore.cycleValue==4">
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

.parent-task-button {
  width: 150px; /* 固定宽度 */;
  display: flex;
  justify-content: space-between;
}

.parent-task-value {
  display: inline-block;
  max-width: 100%; /* 限制文本宽度 */
  overflow: hidden; /* 隐藏超出内容 */
  text-overflow: ellipsis; /* 使用省略号 */
  white-space: nowrap; /* 禁止换行 */
}

</style>



