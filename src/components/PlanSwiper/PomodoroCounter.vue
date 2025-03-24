<script lang="ts" setup>
  import { ref } from 'vue';

  import WhiteTomatoIcon from '@/assets/white_clock.svg';
  import ColorTomatoIcon from '@/assets/red_clock.svg';
  import LightColorTomatoIcon from '@/assets/light_tomato.svg';

  const props = defineProps<{
    totalPomodoro: number;
    finishedPomodoo: number;
    readonly?: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'update:totalPomodoro', value: number): void;
  }>();

  const hoverIndex = ref(0);

  function handleClick(index: number) {
    if (!props.readonly) {
      emit('update:totalPomodoro', index);
    }
  }

  function handleMouseEnter(index: number) {
    if (!props.readonly) {
      hoverIndex.value = index;
    }
  }

  function handleMouseLeave() {
    if (!props.readonly) {
      hoverIndex.value = 0;
    }
  }
</script>

<template>
  <div class="rate-container">
    <div
      v-for="index in 4"
      :key="index"
      @click="handleClick(index)"
      @mouseenter="handleMouseEnter(index)"
      @mouseleave="handleMouseLeave"
    >
      <img
        :src="
          index <= hoverIndex || index <= props.finishedPomodoo
            ? ColorTomatoIcon
            : index <= props.totalPomodoro
            ? LightColorTomatoIcon
            : WhiteTomatoIcon
        "
        class="tomato-icon"
        :class="{ 'cursor-grab': readonly, 'cursor-pointer': !readonly }"
      />
    </div>
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
  }

  .cursor-grab {
    cursor: grab;
  }

  .cursor-pointer {
    cursor: pointer;
  }
</style>
