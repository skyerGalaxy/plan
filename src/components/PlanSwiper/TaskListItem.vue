<script lang="ts" setup>
  import { usePlanerStore } from '@/stores/planStore';

  import { PlayCircleTwoTone } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';

  const props = defineProps({
    item: {
      type: Object,
      required: true,
    },
  });

  const planStore = usePlanerStore();

  const emit = defineEmits(['openModal']);

  const handleOpenModal = () => {
    emit('openModal', props.item);
  };
</script>

<template>
  <template v-if="planStore.cycleValue === 4">
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
  <template v-else>
    <a-list-item>
      <a-list-item-meta>
        <template #avatar>
          <a-avatar style="display: flex; align-items: center">
            <PlayCircleTwoTone twoToneColor="#52c41a" style="font-size: 20px" />
          </a-avatar>
        </template>
        <template #title>
          <div
            @click="handleOpenModal"
            style="cursor: pointer; display: flex; align-items: center; gap: 8px"
          >
            <span style="margin-right: auto">{{ props.item.task }}</span>
            <RangeButton :range="props.item.range" :disable="true" />
          </div>
        </template>
      </a-list-item-meta>
    </a-list-item>
  </template>
</template>
