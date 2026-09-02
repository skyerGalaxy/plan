<script lang="ts" setup>
  import { ref, computed } from 'vue';

  import WhiteTomatoIcon from '@/assets/images/white_clock.svg';
  import ColorTomatoIcon from '@/assets/images/red_clock.svg';
  import LightColorTomatoIcon from '@/assets/images/light_tomato.svg';

  const props = defineProps<{
    totalPomodoro: number;
    finishedPomodoro: number;
    readonly: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'update:totalPomodoro', value: number): void;
  }>();

  const hoverIndex = ref(0);

  // 可交互番茄池大小（编辑模式下固定展示的数量，点击只改变选中几个，行不收缩）
  const EDIT_POOL = 4;

  // 显示数量：
  // - 只读模式（列表展示）：按设定配额显示（未设置时回退 4 个）
  // - 编辑模式（任务弹窗）  ：固定展示 EDIT_POOL 个，供用户点击确定选中数量，不随已选值收缩
  const displayCount = computed(() =>
    props.readonly ? (props.totalPomodoro > 0 ? props.totalPomodoro : EDIT_POOL) : EDIT_POOL
  );

  /**
   * 单个番茄图标状态：
   * - 编辑模式：已选数量（index ≤ totalPomodoro）或悬停预览 → 鲜艳红；其余 → 白色空番茄
   * - 只读模式：已完成 → 鲜艳红；配额内未完成 → 浅色；超出配额 → 白色空番茄
   */
  function iconFor(index: number): string {
    if (!props.readonly) {
      if (index <= hoverIndex.value || index <= props.totalPomodoro) return ColorTomatoIcon;
      return WhiteTomatoIcon;
    }
    const isFinished = index <= props.finishedPomodoro;
    if (isFinished) return ColorTomatoIcon;
    if (index <= props.totalPomodoro) return LightColorTomatoIcon;
    return WhiteTomatoIcon;
  }

  /** 是否需要淡化（仅只读模式）：对「配额内未完成」的番茄降低不透明度以增强对比 */
  function isRemaining(index: number): boolean {
    if (!props.readonly) return false;
    return props.totalPomodoro > 0 && index > props.finishedPomodoro && index > hoverIndex.value;
  }

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
      v-for="index in displayCount"
      :key="index"
      @click="handleClick(index)"
      @mouseenter="handleMouseEnter(index)"
      @mouseleave="handleMouseLeave"
    >
      <img
        :src="iconFor(index)"
        class="tomato-icon"
        :class="{
          remaining: isRemaining(index),
          'cursor-grab': readonly,
          'cursor-pointer': !readonly,
        }"
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

  /* 未完成番茄：降低不透明度并去饱和，与已完成番茄形成明显对比 */
  .remaining {
    opacity: 0.35;
    filter: grayscale(0.6);
    transition:
      opacity 0.2s,
      filter 0.2s;
  }

  .cursor-grab {
    cursor: grab;
  }

  .cursor-pointer {
    cursor: pointer;
  }
</style>
