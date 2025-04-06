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
    updateTask,
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
    (e: 'task-updated', task: any): void;
  }>();

  const taskId = ref<number>(props.task.id);
  const taskValue = ref<string>(props.task.task || '');
  const isLoop = ref<boolean>(props.task.isLoop || false);
  const pomodoroCount = ref<number>(props.task.pomodoro_count || 0);
  const finishedPomodoo = ref<number>(props.task.finished_pomodoro || 0);
  const rangeValue = ref<number>(props.task.range || 1);
  const parentTaskText = ref<string>('选择父任务');
  const parentTaskIndex = ref<number>(1);
  const confirmLoading = ref<boolean>(false);

  watch(
    () => props.task,
    newTask => {
      // Remove array destructuring
      if (props.operateType === 'insert') {
        // Use props.operateType directly
        // Reset fields for new task
        taskId.value = 0;
        taskValue.value = '';
        isLoop.value = false;
        pomodoroCount.value = 0;
        finishedPomodoo.value = 0;
        rangeValue.value = 1;
        parentTaskText.value = '选择父任务';
        parentTaskIndex.value = 1;
      } else if (newTask && Object.keys(newTask).length > 0) {
        // Load task data for editing
        taskId.value = newTask.id;
        taskValue.value = newTask.task || '';
        isLoop.value = newTask.isLoop || false;
        pomodoroCount.value = newTask.pomodoro_count || 0;
        finishedPomodoo.value = newTask.finish_pomodoro || 0;
        rangeValue.value = newTask.range || 1;
        switch (planStore.cycleValue) {
          case 2:
            const quarterlyTask = planStore.parentData.find(
              (item: any) => item.id === newTask.quarterly_id
            );
            parentTaskText.value = quarterlyTask ? quarterlyTask.task : '选择父任务';
            break;
          case 3:
            const monthlyTask = planStore.parentData.find(
              (item: any) => item.id === newTask.monthly_id
            );
            parentTaskText.value = monthlyTask ? monthlyTask.task : '选择父任务';
            break;
          case 4:
            const weeklyTask = planStore.parentData.find(
              (item: any) => item.id === newTask.weekly_id
            );
            parentTaskText.value = weeklyTask ? weeklyTask.task : '选择父任务';
            break;
        }
      }
    },
    {
      immediate: true,
      deep: true,
    }
  );

  const planStore = usePlanerStore();

  function handleMenuClick(task: any) {
    parentTaskText.value = task.task;
    parentTaskIndex.value = task.id;
  }

  function modalCancel() {
    emit('update:visible', false);
    taskId.value = 0;
    taskValue.value = '';
    isLoop.value = false;
    pomodoroCount.value = 0;
    finishedPomodoo.value = 0;
    rangeValue.value = 1;
    parentTaskText.value = '选择父任务';
    parentTaskIndex.value = 1;
    confirmLoading.value = false;
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
      let incomplete = true;
      incomplete = !taskValue.value.trim() || (planStore.cycleValue === 4 && !pomodoroCount.value);
      if (incomplete) {
        notification.warning({
          message: '任务填写不完整',
        });
        confirmLoading.value = false;
        modalCancel();
      } else {
        if (props.operateType === 'insert') {
          try {
            let addedTask = {};
            switch (planStore.cycleValue) {
              case 1:
                addedTask = await insertTaskToQuarter(
                  taskValue.value,
                  planStore.year,
                  planStore.quarter,
                  isLoop.value,
                  rangeValue.value
                );
                emit('task-added', addedTask);
                planStore.isQuarterDataChanged = true;
                break;
              case 2:
                addedTask = await insertTaskToMonth(
                  parentTaskIndex.value,
                  planStore.year,
                  planStore.month,
                  planStore.quarter,
                  taskValue.value,
                  isLoop.value,
                  rangeValue.value
                );
                emit('task-added', addedTask);
                planStore.isMonthDataChanged = true;
                break;

              case 3:
                addedTask = await insertTaskToWeek(
                  parentTaskIndex.value,
                  planStore.year,
                  planStore.month,
                  planStore.weekViewIndex,
                  taskValue.value,
                  isLoop.value,
                  rangeValue.value
                );
                emit('task-added', addedTask);
                planStore.isWeekDataChanged = true;
                break;

              case 4:
                addedTask = await insertTaskToDay(
                  parentTaskIndex.value,
                  planStore.year,
                  planStore.month,
                  planStore.weekViewIndex,
                  props.slideDate,
                  taskValue.value,
                  pomodoroCount.value,
                  rangeValue.value
                );
                emit('task-added', addedTask); // Emit the added task
                planStore.isDayDataChanged = true;
                break;
            }
            openNotificationWithIcon('success');
          } catch (error) {
            openNotificationWithIcon('error');
          }
        } else if (props.operateType === 'update') {
          let tableType;
          let newTask = {};
          switch (planStore.cycleValue) {
            case 1:
              tableType = 'QuarterlyPlans';
              newTask = {
                id: taskId.value,
                task: taskValue.value,
                year: planStore.year,
                quarter: planStore.quarter,
                range: rangeValue.value,
                isLoop: isLoop.value,
              };
              break;
            case 2:
              tableType = 'MonthlyPlans';
              newTask = {
                id: taskId.value,
                quarterly_id: parentTaskIndex.value,
                year: planStore.year,
                month: planStore.month,
                quarter: planStore.quarter,
                task: taskValue.value,
                range: rangeValue.value,
                isLoop: isLoop.value,
              };
              break;
            case 3:
              tableType = 'WeeklyPlans';
              newTask = {
                id: taskId.value,
                monthly_id: parentTaskIndex.value,
                year: planStore.year,
                month: planStore.month,
                week: planStore.weekViewIndex,
                task: taskValue.value,
                range: rangeValue.value,
                isLoop: isLoop.value,
              };
              break;
            case 4:
              tableType = 'DailyPlans';
              newTask = {
                id: taskId.value,
                weekly_id: parentTaskIndex.value,
                year: planStore.year,
                month: planStore.month,
                week: planStore.weekViewIndex,
                day: props.slideDate,
                task: taskValue.value,
                pomodoro_count: pomodoroCount.value,
                range: rangeValue.value,
                finish_pomodoro: 0,
                isFinished: false,
              };
              break;
          }
          try {
            await updateTask(newTask, tableType || 'DailyPlans').then(() => {
              emit('task-updated', newTask);
            });
            openNotificationWithIcon('success');
            switch (planStore.cycleValue) {
              case 1:
                planStore.isQuarterDataChanged = true;
                break;
              case 2:
                planStore.isMonthDataChanged = true;
                break;
              case 3:
                planStore.isWeekDataChanged = true;
                break;
              case 4:
                planStore.isDayDataChanged = true;
                break;
            }
          } catch (error) {
            openNotificationWithIcon('error');
          }
        }
      }
      // 重置表单
      confirmLoading.value = false;
      modalCancel();
    }
  }
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
        <RangeButton v-model:range="rangeValue" />
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px">
        <a-checkbox v-model:checked="isLoop" v-if="planStore.cycleValue !== 4">循环</a-checkbox>
        <a-dropdown v-if="planStore.cycleValue !== 1">
          <template #overlay>
            <a-menu :selected-keys="[parentTaskText.toString()]">
              <a-menu-item
                v-for="(item, index) in planStore.parentData"
                @click="handleMenuClick(item)"
                :key="index"
              >
                <span style="flex: 1">{{ item.task }}</span>
                <RangeButton
                  :style="{ 'margin-left': 'auto', 'pointer-events': 'none' }"
                  :range="item.range"
                  :disable="true"
                />
              </a-menu-item>
            </a-menu>
          </template>
          <a-button class="parent-task-button">
            <span class="parent-task-value">{{ parentTaskText }}</span>
            <DownOutlined :style="{ 'padding-top': '5px' }" />
          </a-button>
        </a-dropdown>
        <div class="rate-container" v-if="planStore.cycleValue == 4">
          <PomodoroCounter
            v-model:totalPomodoro="pomodoroCount"
            :finished-pomodoo="finishedPomodoo"
          />
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
