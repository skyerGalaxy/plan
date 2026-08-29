<script lang="ts" setup>
  import { ref, onMounted } from 'vue';
  import { CoffeeOutlined, HomeOutlined } from '@ant-design/icons-vue';

  import addLightImage from '@/assets/images/add_light.svg';

  import TaskModal from './TaskModal.vue';
  import TaskListItem from './TaskListItem.vue';

  interface Task {
    [key: string]: any;
  }

  const props = defineProps<{
    slideDate: string;
    taskData: Task[];
    /** 周视图：日期范围文本，如 "8.1~8.7" */
    dateRange?: string;
    /** 周视图：工作日天数 */
    workdayCount?: number;
    /** 日视图：工作日/休息日 */
    dayType?: 'workday' | 'restday';
    /** 日视图：细分说明（工作日/调休上班/周末/法定节假日） */
    daySubLabel?: string;
  }>();

  const taskData = ref(props.taskData);

  //modal control
  const modalVisible = ref<boolean>(false);
  const currentTask = ref<Task>({});
  const operateType = ref<string>('');
  const totalTimeConsumed = ref(0);
  const finishedTimeConsumed = ref(0);

  function handleOpenModal(task: Task) {
    operateType.value = 'update';
    currentTask.value = { ...task };
    modalVisible.value = true;
  }

  function handleTaskAdded(newTask: Task): void {
    taskData.value.push(newTask);
    computeTaskTimeConsumption();
  }

  function handleTaskUpdated(updatedTask: Task): void {
    const index = taskData.value.findIndex(task => task.id === updatedTask.id);
    if (index !== -1) {
      taskData.value.splice(index, 1, updatedTask);
      computeTaskTimeConsumption();
    }
  }

  function handleTaskDeleted(taskId: number): void {
    const index = taskData.value.findIndex(task => task.id === taskId);
    if (index !== -1) {
      taskData.value.splice(index, 1);
      computeTaskTimeConsumption();
    }
  }

  function computeTaskTimeConsumption(): void {
    totalTimeConsumed.value = 0;
    finishedTimeConsumed.value = 0;

    for (let i = 0; i < taskData.value.length; i++) {
      const task = taskData.value[i];
      const quota = task.total_pomodoro_quota || 0;
      const singleTaskConsumeTime = quota > 0 ? 25 * quota + 5 * (quota - 1) + 15 : 0;
      totalTimeConsumed.value += singleTaskConsumeTime;

      if (task.status === 'completed') {
        finishedTimeConsumed.value += singleTaskConsumeTime;
      }
    }

    totalTimeConsumed.value = totalTimeConsumed.value / 60;
    finishedTimeConsumed.value = finishedTimeConsumed.value / 60;
  }

  onMounted(() => {
    computeTaskTimeConsumption();
  });
</script>

<template>
  <div class="header">
    <div class="date-area">
      <div class="date-line">
        <span class="date">{{ slideDate }}</span>
        <!-- 日视图：工作日/休息日标识 -->
        <a-tooltip v-if="dayType" :title="daySubLabel">
          <span class="day-type-badge" :class="dayType">
            <CoffeeOutlined v-if="dayType === 'workday'" class="day-type-icon" />
            <HomeOutlined v-else class="day-type-icon" />
            <span class="day-type-text">{{ dayType === 'workday' ? '工作日' : '休息日' }}</span>
          </span>
        </a-tooltip>
      </div>
      <!-- 周视图：日期范围 + 工作日天数 -->
      <div v-if="dateRange" class="date-sub">
        <span class="date-range">{{ dateRange }}</span>
        <span v-if="workdayCount !== undefined" class="workday-count">
          · {{ workdayCount }} 个工作日
        </span>
      </div>
    </div>
    <div class="header-right">
      <a-tooltip
        :title="`预计使用时长${totalTimeConsumed.toFixed(
          2
        )}小时,已完成${finishedTimeConsumed.toFixed(2)}小时`"
      >
        <a-progress
          :percent="(totalTimeConsumed / 8) * 100"
          :success="{ percent: (finishedTimeConsumed / 8) * 100 }"
          type="circle"
          :size="24"
          :showInfo="false"
        />
      </a-tooltip>
      <div id="components-modal-demo-position">
        <button
          @click="
            operateType = 'insert';
            currentTask = {};
            modalVisible = true;
          "
          style="background: none; border: none; padding: 0; cursor: pointer"
        >
          <img :src="addLightImage" alt="Add Plan" class="add-icon" />
        </button>
      </div>
    </div>
  </div>
  <hr class="divider" />
  <div class="list-container">
    <a-list item-layout="vertical" :data-source="taskData" class="full-width-list">
      <template #renderItem="{ item }">
        <TaskListItem :item="item" @open-modal="handleOpenModal" @delete-task="handleTaskDeleted" />
      </template>
    </a-list>

    <TaskModal
      v-model:visible="modalVisible"
      :task="currentTask"
      :operate-type="operateType"
      :slide-date="slideDate"
      @task-added="handleTaskAdded"
      @task-updated="handleTaskUpdated"
    />
  </div>
</template>

<style scoped>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px;
    margin: 15px;
    font-size: larger;
  }

  .date-area {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
  }

  .date-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .date-sub {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: #888;
  }

  .workday-count {
    color: #1677ff;
    font-weight: 500;
  }

  .day-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 18px;
    font-weight: 500;
  }

  .day-type-badge.workday {
    color: #389e0d;
    background: #f6ffed;
    border: 1px solid #b7eb8f;
  }

  .day-type-badge.restday {
    color: #cf1322;
    background: #fff1f0;
    border: 1px solid #ffa39e;
  }

  .day-type-icon {
    font-size: 12px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .add-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .add-icon {
    width: 20px;
    height: 20px;
  }

  .divider {
    margin: 10px;
    border-color: azure;
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
