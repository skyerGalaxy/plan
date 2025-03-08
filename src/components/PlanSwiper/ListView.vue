<script lang="ts" setup>
  import { ref } from 'vue';

  import addLightImage from '@/assets/add_light.svg';
  import WhiteTomatoIcon from '@/assets/white_clock.svg';
  import ColorTomatoIcon from '@/assets/red_clock.svg';
  import { notification } from 'ant-design-vue';
  import { DownOutlined, PlayCircleTwoTone } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';

  import {
    insertTaskToDay,
    insertTaskToQuarter,
    insertTaskToWeek,
    insertTaskToMonth,
  } from '@/utils/supabaseFunction';

  import { usePlanerStore } from '@/stores/planStore';

  const planStore = usePlanerStore();

  interface Task {
    [key: string]: any;
  }
  const props = defineProps<{
    slideDate: string;
    taskData: Task[];
  }>();

  const taskList = ref(props.taskData);

  //modal control
  const modalVisible = ref<boolean>(false);
  const taskValue = ref<string>('');
  const isLoop = ref<boolean>(false);
  const pomodoroCount = ref<number>(0); //current pomodoro count
  const hoverIndex = ref(0); // mouse hover index
  const whiteIcon = WhiteTomatoIcon;
  const coloredIcon = ColorTomatoIcon;
  const parentTaskText = ref<string>('选择父任务');
  const parentTaskIndex = ref<number>(1);
  const confirmLoading = ref<boolean>(false);

  function handleMenuClick(e: { key: number; domEvent: Event }) {
    const text = (e.domEvent.target as HTMLElement).textContent;
    parentTaskText.value = text || '';
    parentTaskIndex.value = e.key;
  }

  function modalCancel() {
    modalVisible.value = false;
    taskValue.value = '';
    planStore.taskRangeIndex = 1;
    planStore.taskRangeInfo = {
      label: '重要且紧急',
      value: 1,
      class: 'priority-urgent-important',
      symbol: 'Ⅰ',
    };
    isLoop.value = false;
    pomodoroCount.value = 0;
    parentTaskText.value = '选择父任务';
  }

  const openNotificationWithIcon = (type: 'success' | 'error') => {
    let message = '';
    let description = '';
    if (type === 'success') {
      message = '添加成功';
      description = '任务已经添加到计划中';
    } else {
      message = '添加失败';
      description = '请检查网络连接或者联系管理员';
    }
    return notification[type]({
      message: message,
      description: description,
    });
  };

  async function modalOk() {
    confirmLoading.value = true;
    if (!navigator.onLine) {
      openNotificationWithIcon('error');
    } else {
      try {
        switch (planStore.cycleValue) {
          case 1:
            await insertTaskToQuarter(
              taskValue.value,
              planStore.year,
              planStore.quarter,
              isLoop.value,
              planStore.taskRangeIndex
            );

            taskList.value.push({
              task: taskValue.value,
              year: planStore.year,
              quarter: planStore.quarter,
              range: planStore.taskRangeIndex,
              isLoop: isLoop.value,
            });
            planStore.isQuarterDataChanged = true;
            break;

          case 2:
            await insertTaskToMonth(
              1,
              planStore.year,
              planStore.month,
              planStore.quarter,
              taskValue.value,
              isLoop.value,
              planStore.taskRangeIndex
            );

            taskList.value.push({
              quarterly_id: 1,
              year: planStore.year,
              month: planStore.month,
              quarter: planStore.quarter,
              task: taskValue.value,
              range: planStore.taskRangeIndex,
              isLoop: isLoop.value,
            });
            planStore.isMonthDataChanged = true;
            break;

          case 3:
            await insertTaskToWeek(
              1,
              planStore.year,
              planStore.month,
              planStore.weekViewIndex,
              taskValue.value,
              isLoop.value,
              planStore.taskRangeIndex
            );

            taskList.value.push({
              monthly_id: 1,
              year: planStore.year,
              month: planStore.month,
              week: planStore.weekViewIndex,
              task: taskValue.value,
              range: planStore.taskRangeIndex,
              isLoop: isLoop.value,
            });
            planStore.isWeekDataChanged = true;
            break;

          case 4:
            await insertTaskToDay(
              parentTaskIndex.value,
              planStore.year,
              planStore.month,
              planStore.weekViewIndex,
              props.slideDate,
              taskValue.value,
              pomodoroCount.value,
              planStore.taskRangeIndex
            );

            taskList.value.push({
              weekly_id: parentTaskIndex.value,
              year: planStore.year,
              month: planStore.month,
              week: planStore.weekViewIndex,
              day: props.slideDate,
              task: taskValue.value,
              pomodoro_count: pomodoroCount.value,
              range: planStore.taskRangeIndex,
              finish_pomodoro: 0,
              isFinished: false,
            });
            planStore.isDayDataChanged = true;
            break;
        }
        openNotificationWithIcon('success');
      } catch (error) {
        openNotificationWithIcon('error');
      }
    }

    // 重置表单
    confirmLoading.value = false;
    modalCancel();
  }
</script>

<template>
  <div class="header">
    <div class="date">{{ slideDate }}</div>
    <div id="components-modal-demo-position">
      <button
        @click="modalVisible = true"
        style="background: none; border: none; padding: 0; cursor: pointer"
      >
        <img :src="addLightImage" alt="Add Plan" style="width: 20px; height: 20px" />
      </button>
      <a-modal
        v-model:open="modalVisible"
        centered
        :confirm-loading="confirmLoading"
        @cancel="modalCancel"
        @ok="modalOk"
      >
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 40px">
          <div style="display: flex; gap: 10px; margin-bottom: 10px">
            <a-input v-model:value="taskValue" placeholder="把事情记下来" />
            <RangeButton />
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px">
            <a-checkbox v-model:checked="isLoop" v-if="planStore.cycleValue !== 4">循环</a-checkbox>
            <a-dropdown v-if="planStore.cycleValue !== 1">
              <template #overlay>
                <a-menu @click="handleMenuClick">
                  <a-menu-item key="1">1st menu item</a-menu-item>
                  <a-menu-item key="2">444444444444444444444444444444</a-menu-item>
                  <a-menu-item key="3">3rd item</a-menu-item>
                </a-menu>
              </template>
              <a-button class="parent-task-button">
                <span class="parent-task-value">{{ parentTaskText }}</span>
                <DownOutlined :style="{ 'padding-top': '5px' }" />
              </a-button>
            </a-dropdown>
            <div class="rate-container" v-if="planStore.cycleValue == 4">
              <PomodoroCounter
                v-model:count="pomodoroCount"
                :colored-icon="coloredIcon"
                :white-icon="whiteIcon"
              />
            </div>
          </div>
        </div>
      </a-modal>
    </div>
  </div>
  <hr style="margin: 10px; border-color: azure" />
  <div class="list-container">
    <a-list item-layout="vertical" :data-source="taskList" class="full-width-list">
      <template #renderItem="{ item }">
        <a-list-item>
          <template #actions>
            <div style="margin-left: 50px">
              <div style="display: flex; align-items: center; gap: 8px">
                <RangeButton :range="item.range" :disable="true" />
                <PomodoroCounter
                  :count="item.pomodoro_count"
                  :colored-icon="coloredIcon"
                  :white-icon="whiteIcon"
                  readonly
                />
              </div>
            </div>
          </template>
          <a-list-item-meta>
            <template #title>
              <span>{{ item.task }}</span>
            </template>
            <template #avatar>
              <a-avatar>
                <PlayCircleTwoTone twoToneColor="#52c41a" style="font-size: 20px" />
              </a-avatar>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<style scoped>
  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 5px;
    margin: 15px;
    font-size: larger;
  }

  .list-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex-wrap: wrap;
    max-height: 500px;
    overflow-y: auto;
  }

  :deep(.full-width-list) {
    width: 100%;
  }

  :deep(.ant-list-item) {
    width: 100%;
  }

  :deep(.ant-list-item-meta) {
    width: 100%;
  }
  :deep(.ant-avatar) {
    background-color: white;
  }

  .circle-checkbox:checked {
    background: #1673ff;
  }

  /* 设置复选框样式 */
  .circle-checkbox {
    width: 25px;
    height: 25px;
    background-color: #ffffff;
    border: solid 1px #dddddd;
    -webkit-border-radius: 50%;
    border-radius: 50%;
    font-size: 0.8rem;
    margin: 0;
    padding: 0;
    position: relative;
    display: inline-block;
    vertical-align: top;
    cursor: default;
    -webkit-appearance: none;
    appearance: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* 设置伪类，即显现的对勾样式 */
  .circle-checkbox:checked::after {
    content: '';
    top: 7px;
    left: 7px;
    position: absolute;
    background-color: #d4e72a;
    background: transparent;
    border: #fff solid 2px;
    border-top: none;
    border-right: none;
    height: 6px;
    width: 10px;
    -moz-transform: rotate(-45deg);
    -ms-transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
    transform: rotate(-45deg);
  }

  .content-column {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 10px;
  }
  .title {
    font-weight: bold;
  }
  .description {
    color: #888;
  }

  .task-content {
    padding: 10px;
    width: 100%;
  }

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
    width: 150px; /* 固定宽度 */
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
