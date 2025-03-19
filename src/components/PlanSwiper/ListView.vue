<script lang="ts" setup>
  import { ref, nextTick } from 'vue';

  import addLightImage from '@/assets/add_light.svg';

  import TaskModal from './TaskModal.vue';
  import TaskListItem from './TaskListItem.vue';

  interface Task {
    [key: string]: any;
  }
  const props = defineProps<{
    slideDate: string;
    taskData: Task[];
  }>();

  //modal control
  const modalVisible = ref<boolean>(false);
  const currentTask = ref({});
  const operateType = ref<string>('');

  function handleOpenModal(task: Task) {
    currentTask.value = {};
    nextTick(() => {
      currentTask.value = task;
      operateType.value = 'update';
      modalVisible.value = true;
    });
  }
</script>

<template>
  <div class="header">
    <div class="date">{{ slideDate }}</div>
    <div id="components-modal-demo-position">
      <button
        @click="
          operateType = 'insert';
          modalVisible = true;
        "
        style="background: none; border: none; padding: 0; cursor: pointer"
      >
        <img :src="addLightImage" alt="Add Plan" style="width: 20px; height: 20px" />
      </button>
    </div>
  </div>
  <hr style="margin: 10px; border-color: azure" />
  <div class="list-container">
    <a-list item-layout="vertical" :data-source="props.taskData" class="full-width-list">
      <template #renderItem="{ item }">
        <TaskListItem :item="item" @open-modal="handleOpenModal" />
      </template>
    </a-list>

    <TaskModal
      v-model:visible="modalVisible"
      :task="currentTask"
      :operate-type="operateType"
      :slide-date="slideDate"
    />
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
