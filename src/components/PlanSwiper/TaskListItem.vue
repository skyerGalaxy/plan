<script lang="ts" setup>
  import { PlayCircleTwoTone } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';

  defineProps({
    item: {
      type: Object,
      required: true,
    },
  });
</script>

<template>
  <a-list-item>
    <template #actions>
      <div style="margin-left: 50px">
        <div style="display: flex; align-items: center; gap: 8px">
          <RangeButton :range="item.range" :disable="true" />
          <PomodoroCounter :count="item.pomodoro_count" readonly />
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
