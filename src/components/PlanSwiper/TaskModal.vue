<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import { notification } from 'ant-design-vue';
  import { DownOutlined, BellOutlined, RedoOutlined, RightOutlined } from '@ant-design/icons-vue';
  import CircleTimeIcon from '@/assets/circleTime.svg';
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

  import VueDatePicker from '@vuepic/vue-datepicker';
  import '@vuepic/vue-datepicker/dist/main.css';
  import type { DatePickerInstance } from '@vuepic/vue-datepicker';

  const date = ref();

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

  const isTimeSettingOpen = ref<boolean>(false);
  const activeTabKey = ref<string>('1');

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
      incomplete = !taskValue.value.trim() && planStore.cycleValue === 4;
      console.log(
        'taskValue.value',
        taskValue.value,
        'planStore.cycleValue',
        planStore.cycleValue,
        'incomplete',
        incomplete
      );
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

  function showCircleTimeModal() {
    isTimeSettingOpen.value = true;
  }

  function closeCircleTimeModal() {
    isTimeSettingOpen.value = false;
  }

  const allowDates = computed(() => {
    const getDayOfMonth = new Date(props.slideDate).getDate() % 7;
    const startDate = new Date(props.slideDate);
    const endDate = new Date(startDate);
    if (getDayOfMonth !== 0) {
      endDate.setDate(startDate.getDate() + (7 - getDayOfMonth));
    }
    const dates: Date[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  });

  //for use datePicker instance
  const singleDatePicker = ref<DatePickerInstance>(null);
  const rangeDatePicker = ref<DatePickerInstance>(null);

  function handleDatePickerOk() {
    switch (activeTabKey.value) {
      case '1':
        // Handle single date selection
        if (singleDatePicker.value) {
          singleDatePicker.value.selectDate();
        }
        break;
      case '2':
        // Handle range date selection
        if (rangeDatePicker.value) {
          rangeDatePicker.value.selectDate();
        }
        break;
      case '3':
        // Ebbinghaus cycle, no specific date needed
        date.value = null;
        break;
    }
    closeCircleTimeModal();
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
                <div
                  v-if="item.task.length > 13"
                  style="display: flex; justify-content: space-between; width: 100%"
                >
                  <a-tooltip v-if="item.task.length > 13" :title="item.task">
                    <span>
                      {{ item.task.substring(0, 13) + '...' }}
                    </span>
                  </a-tooltip>
                  <RangeButton :range="item.range" :disable="true" />
                </div>
                <div v-else style="display: flex; justify-content: space-between; width: 100%">
                  <span>{{ item.task }}</span>
                  <RangeButton :range="item.range" :disable="true" />
                </div>
              </a-menu-item>
            </a-menu>
          </template>
          <a-button class="parent-task-button">
            <span class="parent-task-value">{{ parentTaskText }}</span>
            <DownOutlined :style="{ 'padding-top': '5px' }" />
          </a-button>
        </a-dropdown>
        <div v-if="planStore.cycleValue == 4" style="width: 32px; height: 32px">
          <img :src="CircleTimeIcon" @click="showCircleTimeModal" />
        </div>
        <div class="rate-container" v-if="planStore.cycleValue == 4">
          <PomodoroCounter
            v-model:totalPomodoro="pomodoroCount"
            :finishedPomodoro="finishedPomodoo"
            :readonly="false"
          />
        </div>
      </div>
    </div>
    <a-modal
      v-model:open="isTimeSettingOpen"
      :centered="true"
      @ok="handleDatePickerOk"
      @cancel="closeCircleTimeModal"
    >
      <a-tabs v-model:activeKey="activeTabKey" :centered="true">
        <a-tab-pane key="1" tab="时间点">
          <div style="min-height: 370px; display: flex; align-items: center">
            <VueDatePicker
              v-model="date"
              inline
              multi-dates
              :enable-time-picker="false"
              style="width: 100%; display: block"
              disable-month-year-select
              :allowed-dates="allowDates"
              :action-row="{
                showSelect: false,
                showCancel: false,
                showNow: false,
                showPreview: false,
              }"
              ref="singleDatePicker"
            ></VueDatePicker>
          </div>
        </a-tab-pane>
        <a-tab-pane key="2" tab="时间段" force-render>
          <div style="min-height: 370px; display: flex; align-items: center">
            <VueDatePicker
              v-model="date"
              inline
              range
              :enable-time-picker="false"
              :allowed-dates="allowDates"
              disable-month-year-select
              style="width: 100%; display: block"
              :action-row="{
                showSelect: false,
                showCancel: false,
                showNow: false,
                showPreview: false,
              }"
              ref="rangeDatePicker"
            ></VueDatePicker>
          </div>
        </a-tab-pane>
        <a-tab-pane key="3" tab="艾宾浩斯">
          <div
            style="
              min-height: 370px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 10px;
            "
          >
            <div
              style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
              "
            >
              <p>你已选择艾宾浩斯循环</p>
              <p>任务将按照艾宾浩斯的时间间隔进行复习</p>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
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
