<script setup lang="ts">
  /**
   * 桌面宠物窗口 —— 纯渲染层。
   * 计时核心、状态流转、窗口显隐均由 Rust 后端驱动；
   * 本组件仅订阅 `pomodoro_state_update` 事件渲染，并通过 invoke 触发后端命令。
   */
  import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { PhysicalPosition } from '@tauri-apps/api/window';
  import { message } from 'ant-design-vue';
  import {
    onPomodoroStateUpdate,
    pausePomodoro,
    resumePomodoro,
    interruptSavePomodoro,
    showMainWindow,
    savePetPosition,
    type PomodoroStatePayload,
    type UnlistenFn,
  } from '@/api/pomodoro';

  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const currentWindow = inTauri ? getCurrentWebviewWindow() : null;

  // ---- 状态源（事件驱动，无本地计时器）----
  const state = ref<PomodoroStatePayload | null>(null);
  let unlisten: UnlistenFn | null = null;

  const status = computed(() => state.value?.status ?? 'idle');
  const displayTime = computed(() => {
    const total = Math.max(0, state.value?.remain_seconds ?? 0);
    const mm = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const ss = (total % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  // 桌宠动画状态
  const petPhase = computed(() => (status.value === 'paused' ? 'paused' : 'focus'));

  // ---- 悬停提示 ----
  const hoverTime = ref(false);

  // ---- 右键菜单 ----
  const menuOpen = ref(false);
  const menuX = ref(0);
  const menuY = ref(0);
  const menuRef = ref<HTMLElement | null>(null);

  function apply(payload: PomodoroStatePayload | null) {
    if (payload) state.value = payload;
  }

  // ---- 菜单（严格按后端状态渲染）----
  const menuVisible = computed(() =>
    ['running', 'paused', 'completed', 'interrupted_saved'].includes(status.value)
  );

  async function openMenu(e: MouseEvent) {
    e.preventDefault();
    if (!menuVisible.value) return;
    menuOpen.value = true;
    menuX.value = e.clientX;
    menuY.value = e.clientY;
    // 等菜单渲染后再测量尺寸，把位置钳制在窗口内，避免边缘被裁剪
    await nextTick();
    const el = menuRef.value;
    if (el) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      menuX.value = Math.max(4, Math.min(menuX.value, vw - w - 4));
      menuY.value = Math.max(4, Math.min(menuY.value, vh - h - 4));
    }
  }

  async function onPause() {
    menuOpen.value = false;
    try {
      apply(await pausePomodoro());
    } catch (e: any) {
      message.error(e?.message || '暂停失败');
    }
  }

  async function onInterruptSave() {
    menuOpen.value = false;
    try {
      apply(await interruptSavePomodoro());
    } catch (e: any) {
      message.error(e?.message || '中断保存失败');
    }
  }

  async function onResume() {
    menuOpen.value = false;
    try {
      apply(await resumePomodoro());
    } catch (e: any) {
      message.error(e?.message || '继续运行失败');
    }
  }

  function onBackToList() {
    menuOpen.value = false;
    void showMainWindow();
  }

  // ---- 拖拽移动（松开保存坐标，限制在屏幕内）----
  const isDragging = ref(false);
  const didDrag = ref(false);
  let dragStartScreenX = 0;
  let dragStartScreenY = 0;
  let dragStartWinX = 0;
  let dragStartWinY = 0;

  async function onMouseDown(e: MouseEvent) {
    if (e.button !== 0 || !currentWindow) return;
    isDragging.value = true;
    didDrag.value = false;
    dragStartScreenX = e.screenX;
    dragStartScreenY = e.screenY;
    const pos = await currentWindow.outerPosition();
    dragStartWinX = pos?.x ?? 0;
    dragStartWinY = pos?.y ?? 0;
  }

  async function onMouseMove(e: MouseEvent) {
    if (!isDragging.value || !currentWindow) return;
    if (Math.abs(e.screenX - dragStartScreenX) > 3 || Math.abs(e.screenY - dragStartScreenY) > 3) {
      didDrag.value = true;
    }
    const nx = dragStartWinX + (e.screenX - dragStartScreenX);
    const ny = dragStartWinY + (e.screenY - dragStartScreenY);
    await currentWindow.setPosition(new PhysicalPosition(nx, ny));
  }

  async function onMouseUp() {
    if (!isDragging.value) return;
    isDragging.value = false;
    if (didDrag.value && currentWindow) {
      const pos = await currentWindow.outerPosition();
      if (pos) void savePetPosition(pos.x, pos.y);
    }
  }

  // ---- 双击召回主窗口 ----
  function onDblClick() {
    if (didDrag.value) return;
    void showMainWindow();
  }

  // ---- 关闭菜单（点击其它区域）----
  function onShellClick() {
    if (menuOpen.value) menuOpen.value = false;
  }

  onMounted(async () => {
    unlisten = await onPomodoroStateUpdate(apply);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  onBeforeUnmount(() => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  });
</script>

<template>
  <div
    class="pet-root"
    :class="`pet-${petPhase}`"
    @contextmenu.prevent="openMenu"
    @mousedown.left="onMouseDown"
    @dblclick="onDblClick"
    @click="onShellClick"
    @mouseenter="hoverTime = true"
    @mouseleave="hoverTime = false"
  >
    <div class="pet-card">
      <div class="pet-title" :title="state?.task_title || ''">
        {{ state?.task_title || '番茄钟' }}
      </div>

      <div class="pet-time">{{ displayTime }}</div>

      <div class="pet-status">
        <span v-if="status === 'running'" class="dot running"></span>
        <span v-else-if="status === 'paused'" class="dot paused"></span>
        <span v-else class="dot idle"></span>
        <span v-if="status === 'running'">专注中</span>
        <span v-else-if="status === 'paused'">已暂停</span>
        <span v-else-if="status === 'completed'">完成 🎉</span>
        <span v-else-if="status === 'interrupted_saved'">已中断保存</span>
        <span v-else>空闲</span>
      </div>

      <!-- 悬停提示：剩余时间 -->
      <div v-show="hoverTime" class="hover-bubble">剩余 {{ displayTime }}</div>

      <!-- 右键菜单（严格按状态渲染，钳制在窗口内） -->
      <div
        v-if="menuOpen"
        ref="menuRef"
        class="bubble-menu"
        :style="{ left: menuX + 'px', top: menuY + 'px' }"
        @click.stop
        @mousedown.stop
        @contextmenu.prevent.stop
      >
        <button v-if="status === 'running'" @click="onPause">暂停</button>
        <button v-if="status === 'running'" @click="onInterruptSave">中断保存</button>
        <button v-if="status === 'paused'" @click="onResume">继续运行</button>
        <button
          v-if="status === 'completed' || status === 'interrupted_saved'"
          @click="onBackToList"
        >
          返回任务列表
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
  :global(body) {
    margin: 0;
    padding: 0 !important;
    overflow: hidden;
    background: transparent;
  }

  :global(#app) {
    background: transparent !important;
    overflow: hidden;
  }

  .pet-root {
    position: relative;
    width: 240px;
    height: 130px;
    user-select: none;
    cursor: grab;
  }

  .pet-root:active {
    cursor: grabbing;
  }

  .pet-card {
    position: relative;
    margin: 8px;
    height: 114px;
    border-radius: 16px;
    padding: 8px 12px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(24, 32, 40, 0.82);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
    color: #fff;
    transition: background 0.2s;
  }

  .pet-focus .pet-card {
    background: linear-gradient(160deg, rgba(255, 99, 71, 0.82), rgba(40, 88, 112, 0.82));
  }

  .pet-paused .pet-card {
    background: rgba(24, 32, 40, 0.82);
  }

  .pet-title {
    width: 100%;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: center;
  }

  .pet-time {
    font-size: 34px;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    letter-spacing: 1px;
  }

  .pet-status {
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.85);
  }

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot.running {
    background: #52e07c;
    animation: pulse 1s infinite;
  }
  .dot.paused {
    background: #ffb347;
  }
  .dot.idle {
    background: #9aa5af;
  }

  .hover-bubble {
    position: absolute;
    left: 50%;
    top: -6px;
    transform: translate(-50%, -100%);
    padding: 4px 9px;
    border-radius: 9px;
    background: rgba(28, 31, 39, 0.9);
    color: #fff;
    font-size: 12px;
    white-space: nowrap;
    pointer-events: none;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .bubble-menu {
    position: fixed;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px;
    border-radius: 10px;
    background: rgba(22, 26, 32, 0.94);
    backdrop-filter: blur(6px);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.3);
    z-index: 20;
    min-width: 96px;
    cursor: default;
  }

  .bubble-menu button {
    border: none;
    border-radius: 7px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 6px 10px;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .bubble-menu button:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
</style>
