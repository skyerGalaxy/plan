<script lang="ts" setup>
  import { PlayCircleTwoTone } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';

  const props = defineProps({
    item: {
      type: Object,
      required: true,
    },
  });

  const emit = defineEmits(['openModal']);

  const handleOpenModal = () => {
    emit('openModal', props.item);
  };
</script>

<template>
  <a-list-item>
    <template #actions>
      <div style="margin-left: 50px">
        <div style="display: flex; align-items: center; gap: 8px">
          <RangeButton :range="props.item.range" :disable="true" />
          <PomodoroCounter :count="props.item.pomodoro_count" readonly />
        </div>
      </div>
    </template>
    <a-list-item-meta>
      <template #title>
        <div @click="handleOpenModal" style="cursor: pointer">
          <span>{{ props.item.task }}</span>
        </div>
      </template>
      <template #avatar>
        <a-avatar>
          <PlayCircleTwoTone twoToneColor="#52c41a" style="font-size: 20px" />
        </a-avatar>
      </template>
    </a-list-item-meta>
  </a-list-item>
</template>
