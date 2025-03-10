<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { notification } from 'ant-design-vue';
  import { DownOutlined } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';
  import { usePlanerStore } from '@/stores/planStore';
  import {
    insertTaskToDay,
    insertTaskToQuarter,
    insertTaskToWeek,
    insertTaskToMonth,
  } from '@/utils/supabaseFunction';

  const props = defineProps<{
    operateType: string; //inser on update,decide modalOk function
    task: any;
    visible: boolean;
    slideDate: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'task-added', task: any): void;
  }>();

  const planStore = usePlanerStore();
  const taskValue = ref<string>(props.task.task || '');
  const isLoop = ref<boolean>(props.task.isLoop || false);
  const pomodoroCount = ref<number>(props.task.pomodoro_count || 0);
  const rangeValue = ref<number>(props.task.range || 1);
  const parentTaskText = ref<string>('选择父任务');
  const parentTaskIndex = ref<number>(1);
  const confirmLoading = ref<boolean>(false);

  function handleMenuClick(e: { key: number; domEvent: Event }) {
    const text = (e.domEvent.target as HTMLElement).textContent;
    parentTaskText.value = text || '';
    parentTaskIndex.value = e.key;
  }

  function modalCancel() {
    emit('update:visible', false);
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
    let message = type === 'success' ? '添加成功' : '添加失败';
    let description = type === 'success' ? '任务已经添加到计划中' : '请检查网络连接或者联系管理员';
    return notification[type]({ message, description });
  };

  async function modalOk() {
    confirmLoading.value = true;
    if (!navigator.onLine) {
      openNotificationWithIcon('error');
    } else {
      if (!taskValue.value.trim() || pomodoroCount.value === 0) {
        notification.warning({
          message: '任务填写不完整',
        });
        confirmLoading.value = false;
        modalCancel();
      } else {
        try {
          let newTask;
          switch (planStore.cycleValue) {
            case 1:
              await insertTaskToQuarter(
                taskValue.value,
                planStore.year,
                planStore.quarter,
                isLoop.value,
                planStore.taskRangeIndex
              );

              newTask = {
                task: taskValue.value,
                year: planStore.year,
                quarter: planStore.quarter,
                range: planStore.taskRangeIndex,
                isLoop: isLoop.value,
              };
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

              newTask = {
                quarterly_id: 1,
                year: planStore.year,
                month: planStore.month,
                quarter: planStore.quarter,
                task: taskValue.value,
                range: planStore.taskRangeIndex,
                isLoop: isLoop.value,
              };
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

              newTask = {
                monthly_id: 1,
                year: planStore.year,
                month: planStore.month,
                week: planStore.weekViewIndex,
                task: taskValue.value,
                range: planStore.taskRangeIndex,
                isLoop: isLoop.value,
              };
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

              newTask = {
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
              };
              planStore.isDayDataChanged = true;
              break;
          }
          emit('task-added', newTask);
          openNotificationWithIcon('success');
        } catch (error) {
          openNotificationWithIcon('error');
        }
      }
    }
    // 重置表单
    confirmLoading.value = false;
    modalCancel();
  }

  watch(
    () => props.task,
    newTask => {
      taskValue.value = newTask.task || '';
      isLoop.value = newTask.isLoop || false;
      pomodoroCount.value = newTask.pomodoro_count || 0;
      rangeValue.value = newTask.range || 1;
    },
    {
      immediate: true,
      deep: true,
    }
  );
</script>

<template>
  <a-modal
    :open="visible"
    @update:open="(val: boolean) => emit('update:visible', val)"
    centered
    :confirm-loading="confirmLoading"
    @cancel="modalCancel"
    @ok="modalOk"
  >
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 40px">
      <div style="display: flex; gap: 10px; margin-bottom: 10px">
        <a-input v-model:value="taskValue" placeholder="把事情记下来" />
        <RangeButton :range="rangeValue" />
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
          <PomodoroCounter v-model:count="pomodoroCount" />
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
  .parent-task-button {
    width: 150px;
    display: flex;
    justify-content: space-between;
  }

  .parent-task-value {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rate-container {
    display: flex;
    gap: 8px;
  }
</style>
