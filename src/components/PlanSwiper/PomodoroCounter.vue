<script lang="ts" setup>
  import { ref } from 'vue';

  interface Props {
    count?: number; // 当前番茄数
    maxCount?: number; // 最大番茄数
    readonly?: boolean; // 是否只读
    coloredIcon: string; // 彩色图标
    whiteIcon: string; // 白色图标
  }

  const props = withDefaults(defineProps<Props>(), {
    count: 0,
    maxCount: 4,
    readonly: false,
  });

  const emit = defineEmits<{
    (e: 'update:count', value: number): void;
  }>();

  const hoverIndex = ref(0);

  function handleClick(index: number) {
    if (!props.readonly) {
      emit('update:count', index);
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
      v-for="index in maxCount"
      :key="index"
      @click="handleClick(index)"
      @mouseenter="handleMouseEnter(index)"
      @mouseleave="handleMouseLeave"
    >
      <img
        :src="index <= (hoverIndex || count) ? coloredIcon : whiteIcon"
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
