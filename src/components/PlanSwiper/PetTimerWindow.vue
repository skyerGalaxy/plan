<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { PhysicalPosition } from '@tauri-apps/api/window';
  import { getRepository } from '@/api';

  const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  const repo = getRepository();
  const currentWindow = isDesktop ? getCurrentWebviewWindow() : null;

  type Phase = 'focus' | 'pause' | 'rest';

  interface PetStartPayload {
    task_id: string;
    task_name: string;
    work_minutes?: number;
    started_at?: number;
  }

  const phase = ref<Phase>('focus');
  const taskId = ref('');
  const taskName = ref('番茄任务');
  const startedAt = ref(0);
  const endAt = ref(0);
  const workMinutes = ref(25);
  const dailyTarget = ref(8);
  const doneToday = ref(0);
  const remainingMs = ref(25 * 60 * 1000);
  const menuOpen = ref(false);
  const hoverTime = ref(false);
  const pinTop = ref(true);
  const isDragging = ref(false);
  const dragOffsetX = ref(0);
  const dragOffsetY = ref(0);

  let tickTimer: number | undefined;
  let startListener: UnlistenFn | undefined;
  let stopListener: UnlistenFn | undefined;
  let closeListener: UnlistenFn | undefined;
  let openMainListener: UnlistenFn | undefined;

  const displayTime = computed(() => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs.value / 1000));
    const mm = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const ss = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  const tomatoList = computed(() =>
    Array.from({ length: Math.max(0, dailyTarget.value) }, (_, index) => index < doneToday.value)
  );

  function stopTick() {
    if (tickTimer !== undefined) {
      window.clearInterval(tickTimer);
      tickTimer = undefined;
    }
  }

  function startTick() {
    stopTick();
    tickTimer = window.setInterval(() => {
      if (phase.value === 'focus' && endAt.value > 0) {
        const next = Math.max(0, endAt.value - Date.now());
        remainingMs.value = next;
        if (next <= 0) {
          void completePomodoro();
        }
      }
    }, 250);
  }

  async function loadSchedule() {
    try {
      const schedule = await repo.getActivePomoSchedule();
      if (schedule) {
        workMinutes.value = Number(schedule.pomodoro_work_minutes || 25);
        dailyTarget.value = Number(schedule.daily_pomo_count || 8);
      }
    } catch (error) {
      console.error('加载番茄配置失败', error);
    }
  }

  async function refreshTodayCompleted() {
    try {
      const records = await repo.listPomodoroRecords({
        recordDate: new Date().toISOString().slice(0, 10),
      });
      doneToday.value = records.filter(item => item.status === 'completed').length;
    } catch (error) {
      console.warn('刷新当日完成数失败', error);
      doneToday.value = 0;
    }
  }

  async function beginFocus(payload: PetStartPayload) {
    taskId.value = payload.task_id;
    taskName.value = payload.task_name || '番茄任务';
    workMinutes.value = payload.work_minutes ?? workMinutes.value;

    const now = Date.now();
    startedAt.value = payload.started_at ?? now;
    endAt.value = now + workMinutes.value * 60 * 1000;
    remainingMs.value = workMinutes.value * 60 * 1000;
    phase.value = 'focus';
    startTick();
    await refreshTodayCompleted();
  }

  async function completePomodoro() {
    if (!taskId.value || !startedAt.value) return;

    stopTick();
    const endTime = new Date(endAt.value || Date.now()).toISOString();
    const startTime = new Date(startedAt.value).toISOString();

    try {
      const durationMinutes = Math.max(1, Math.round((endAt.value - startedAt.value) / 60000));
      await repo.createPomodoroRecord({
        id: crypto.randomUUID(),
        task_id: taskId.value,
        resume_count: 0,
        interrupt_duration_seconds: 0,
        reward_gold: 0,
        record_date: new Date().toISOString().slice(0, 10),
        start_time: startTime,
        end_time: endTime,
        effective_total_seconds: durationMinutes * 60,
        status: 'completed',
      });
      doneToday.value = Math.min(dailyTarget.value, doneToday.value + 1);
    } catch (error) {
      console.error('写入自然完成记录失败', error);
    }

    phase.value = 'rest';
    remainingMs.value = 0;

    window.setTimeout(() => {
      phase.value = 'focus';
      const nextNow = Date.now();
      startedAt.value = nextNow;
      endAt.value = nextNow + workMinutes.value * 60 * 1000;
      remainingMs.value = workMinutes.value * 60 * 1000;
      startTick();
    }, 1200);

    if (isDesktop) {
      await emit('pet:completed', {
        task_id: taskId.value,
        task_name: taskName.value,
      });
    }
  }

  async function stopFocusByManual() {
    if (!taskId.value || !startedAt.value) return;

    const elapsed = Date.now() - startedAt.value;
    const shouldWrite = elapsed >= 60 * 1000;

    if (shouldWrite) {
      try {
        await repo.createPomodoroRecord({
          id: crypto.randomUUID(),
          task_id: taskId.value,
          record_date: new Date().toISOString().slice(0, 10),
          start_time: new Date(startedAt.value).toISOString(),
          end_time: new Date().toISOString(),
          resume_count: 0,
          interrupt_duration_seconds: 0,
          reward_gold: 0,
          effective_total_seconds: Math.max(60, Math.round(elapsed / 1000)),
          status: 'interrupted',
        });
      } catch (error) {
        console.error('手动结束记录写入失败', error);
      }
    }

    stopTick();
    phase.value = 'focus';
    remainingMs.value = workMinutes.value * 60 * 1000;

    if (isDesktop) {
      await emit('pet:finished', {
        task_id: taskId.value,
        task_name: taskName.value,
      });
    }

    if (currentWindow) {
      await currentWindow.close();
    }
  }

  async function togglePause() {
    if (phase.value === 'focus') {
      phase.value = 'pause';
      stopTick();
      if (isDesktop) {
        await emit('pet:paused', { task_id: taskId.value, task_name: taskName.value });
      }
      return;
    }

    if (phase.value === 'pause') {
      phase.value = 'focus';
      endAt.value = Date.now() + remainingMs.value;
      startTick();
      if (isDesktop) {
        await emit('pet:resumed', { task_id: taskId.value, task_name: taskName.value });
      }
    }
  }

  async function openMainWindow() {
    if (!isDesktop) return;

    try {
      const mainWindow = await WebviewWindow.getByLabel('main');
      if (mainWindow) {
        await mainWindow.show();
        await mainWindow.setFocus();
      }
    } catch {
      // no-op when the parent window is not yet available
    }
  }

  async function bindPetEvents() {
    if (!isDesktop) return;
    startListener = await listen('pet:start', event => {
      const payload = event.payload as PetStartPayload;
      void beginFocus(payload);
    });

    closeListener = await listen('pet:close', () => {
      void currentWindow?.close();
    });

    openMainListener = await listen('pet:open-main', () => {
      void openMainWindow();
    });

    stopListener = await listen('pet:pause', () => {
      void togglePause();
    });
  }

  async function handleMouseDown(event: MouseEvent) {
    if (!isDesktop || !currentWindow) return;
    const pos = await currentWindow.outerPosition();
    isDragging.value = true;
    dragOffsetX.value = event.clientX - pos.x;
    dragOffsetY.value = event.clientY - pos.y;
  }

  async function handleMouseMove(event: MouseEvent) {
    if (!isDragging.value || !currentWindow || !isDesktop) return;
    await currentWindow.setPosition(
      new PhysicalPosition(event.screenX - dragOffsetX.value, event.screenY - dragOffsetY.value)
    );
  }

  function handleMouseUp() {
    isDragging.value = false;
  }

  onMounted(async () => {
    await loadSchedule();
    await refreshTodayCompleted();
    await bindPetEvents();
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onBeforeUnmount(() => {
    stopTick();
    if (startListener) startListener();
    if (stopListener) stopListener();
    if (closeListener) closeListener();
    if (openMainListener) openMainListener();
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });
</script>

<template>
  <div class="pet-shell" @contextmenu.prevent @mousedown="handleMouseDown" @mouseup="handleMouseUp">
    <div class="pet-body" :class="`pet-${phase}`">
      <div class="pet-face">
        <div class="eye left"></div>
        <div class="eye right"></div>
        <div class="mouth"></div>
      </div>
      <div class="pet-ears">
        <span></span>
        <span></span>
      </div>
      <div class="pet-paw" v-for="n in 2" :key="n"></div>
    </div>

    <div class="tomato-row" v-if="dailyTarget > 0">
      <span
        v-for="(done, index) in tomatoList"
        :key="index"
        class="tomato"
        :class="done ? 'done' : 'undone'"
      ></span>
    </div>

    <div class="hover-bubble" v-show="hoverTime">
      {{ displayTime }}
    </div>

    <div v-show="menuOpen" class="bubble-menu">
      <button @click="togglePause">
        {{ phase === 'pause' ? '继续' : '暂停' }}
      </button>
      <button @click="stopFocusByManual">结束专注</button>
      <button @click="openMainWindow">打开主窗口</button>
    </div>
  </div>
</template>

<style scoped>
  :global(body) {
    margin: 0;
    overflow: hidden;
    background: transparent;
  }

  .pet-shell {
    position: relative;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    user-select: none;
    cursor: move;
  }

  .pet-body {
    position: absolute;
    left: 50%;
    top: 44%;
    width: 96px;
    height: 96px;
    transform: translate(-50%, -50%);
    border-radius: 44% 44% 42% 42%;
    background: linear-gradient(180deg, #d8f5ff 0%, #9ad6e8 100%);
    box-shadow: 0 10px 18px rgba(40, 88, 112, 0.2);
    animation: float 2.8s ease-in-out infinite;
  }

  .pet-focus {
    animation: focus-breathe 2.4s ease-in-out infinite;
  }

  .pet-pause {
    transform: translate(-50%, -50%) rotate(-2deg);
  }

  .pet-rest {
    transform: translate(-50%, -50%) scale(0.96);
    animation: resting 3.5s ease-in-out infinite;
  }

  .pet-face {
    position: absolute;
    inset: 0;
  }

  .eye {
    position: absolute;
    width: 7px;
    height: 10px;
    top: 42px;
    border-radius: 50%;
    background: #1d2a33;
  }

  .eye.left {
    left: 28px;
  }
  .eye.right {
    right: 28px;
  }

  .mouth {
    position: absolute;
    left: 50%;
    bottom: 26px;
    width: 26px;
    height: 14px;
    transform: translateX(-50%);
    border-bottom: 3px solid #2b3840;
    border-radius: 0 0 18px 18px;
  }

  .pet-ears span {
    position: absolute;
    top: -10px;
    width: 18px;
    height: 18px;
    background: #9ad6e8;
    border-radius: 50% 50% 0 0;
  }

  .pet-ears span:first-child {
    left: 20px;
    transform: rotate(-18deg);
  }
  .pet-ears span:last-child {
    right: 20px;
    transform: rotate(18deg);
  }

  .pet-paw {
    position: absolute;
    bottom: -8px;
    width: 18px;
    height: 20px;
    border-radius: 14px;
    background: rgba(93, 167, 196, 0.9);
  }

  .pet-paw:nth-child(3) {
    left: 26px;
  }
  .pet-paw:nth-child(4) {
    right: 26px;
  }

  .tomato-row {
    position: absolute;
    left: 50%;
    bottom: 8px;
    transform: translateX(-50%);
    display: flex;
    gap: 6px;
  }

  .tomato {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
    position: relative;
    box-shadow: inset -2px -2px 0 rgba(0, 0, 0, 0.08);
  }

  .tomato.done {
    background: linear-gradient(180deg, #ff6b6b 0%, #d62828 100%);
  }

  .tomato.done::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 3px;
    height: 3px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.6);
  }

  .tomato.undone {
    background: linear-gradient(180deg, #efefef 0%, #d0d0d0 100%);
  }

  .hover-bubble {
    position: absolute;
    left: 50%;
    top: -18px;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: 10px;
    background: rgba(28, 31, 39, 0.72);
    color: #fff;
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
  }

  .bubble-menu {
    position: absolute;
    left: 50%;
    top: 18px;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(22, 26, 32, 0.8);
    backdrop-filter: blur(6px);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  }

  .bubble-menu button {
    border: none;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 6px 10px;
    font-size: 12px;
    cursor: pointer;
  }

  @keyframes focus-breathe {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.05);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(-50%, -50%) translateY(0);
    }
    50% {
      transform: translate(-50%, -50%) translateY(-5px);
    }
  }

  @keyframes resting {
    0%,
    100% {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    50% {
      transform: translate(-50%, -50%) rotate(-4deg) scale(0.98);
    }
  }
</style>
