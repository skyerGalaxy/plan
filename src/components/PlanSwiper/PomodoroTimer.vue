<template>
  <div class="timer-container">
    <!-- Timer Display with Circular Progress Bar -->
    <div class="timer-display">
      <p class="task-title">{{ displayTitle }}</p>
      <!-- completed 显示完成提示与金币 -->
      <div v-if="state && state.status === 'completed'" class="completed-panel">
        <p class="done-tip">番茄钟完成！</p>
        <p class="reward">获得金币：{{ state.reward_gold }}</p>
      </div>
      <!-- 中断保存 / 空闲提示 -->
      <div v-else-if="state && state.status === 'interrupted_saved'" class="completed-panel">
        <p class="done-tip">番茄钟已中断保存，返回任务列表可继续。</p>
      </div>
      <div v-else-if="!state || state.status === 'idle'" class="completed-panel">
        <p class="done-tip">暂无进行中的番茄钟</p>
      </div>

      <div v-if="showTimer" class="timer">
        <svg class="progress-ring" width="200" height="200">
          <circle
            class="progress-ring__track"
            cx="100"
            cy="100"
            r="90"
            fill="transparent"
            stroke="#eee"
            stroke-width="8"
          />
          <circle
            class="progress-ring__circle"
            cx="100"
            cy="100"
            r="90"
            fill="transparent"
            stroke="#ff6347"
            stroke-width="8"
            :stroke-dasharray="`${circumference} ${circumference}`"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <span class="time-text">{{ formattedTime }}</span>
      </div>
    </div>

    <!-- Control Buttons（按后端状态渲染） -->
    <div class="buttons">
      <template v-if="state && state.status === 'running'">
        <button @click="onPause">暂停</button>
        <button @click="onInterruptSave">中断保存</button>
      </template>
      <template v-else-if="state && state.status === 'paused'">
        <button @click="onResume">继续运行</button>
      </template>
      <template v-else-if="state && state.status === 'completed'">
        <button @click="backToList">返回任务列表</button>
      </template>
      <template
        v-else-if="state && (state.status === 'interrupted_saved' || state.status === 'idle')"
      >
        <button @click="backToList">返回任务列表</button>
      </template>
    </div>
    <p v-if="state && state.status === 'running'" class="resume-hint">
      打断次数：{{ state.resume_count }}
    </p>
  </div>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { message } from 'ant-design-vue';
  import {
    getPomodoroState,
    pausePomodoro,
    resumePomodoro,
    interruptSavePomodoro,
    onPomodoroStateUpdate,
    type PomodoroStatePayload,
    type UnlistenFn,
  } from '@/api/pomodoro';

  const router = useRouter();
  const state = ref<PomodoroStatePayload | null>(null);
  let unlisten: UnlistenFn | null = null;

  const displayTitle = computed(() => state.value?.task_title || '番茄钟');

  // 需要显示计时（running / paused）
  const showTimer = computed(() => {
    const s = state.value;
    return !!s && (s.status === 'running' || s.status === 'paused');
  });

  const circumference = 2 * Math.PI * 90;

  /** 剩余秒数格式化 mm:ss */
  const formattedTime = computed(() => {
    const s = state.value;
    const total = Math.max(0, s?.remain_seconds ?? 0);
    const mm = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const ss = (total % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  /** 进度环偏移：按剩余/目标计算 */
  const dashOffset = computed(() => {
    const s = state.value;
    const target = s?.target_seconds ?? 0;
    const remain = s?.remain_seconds ?? 0;
    const ratio = target > 0 ? remain / target : 0;
    return circumference - ratio * circumference;
  });

  function apply(payload: PomodoroStatePayload | null) {
    if (payload) state.value = payload;
  }

  async function onPause() {
    try {
      apply(await pausePomodoro());
    } catch (e: any) {
      message.error(e?.message || '暂停失败');
    }
  }

  async function onResume() {
    try {
      apply(await resumePomodoro());
    } catch (e: any) {
      message.error(e?.message || '继续运行失败');
    }
  }

  async function onInterruptSave() {
    try {
      apply(await interruptSavePomodoro());
    } catch (e: any) {
      message.error(e?.message || '中断保存失败');
    } finally {
      // 中断保存后自动退出页面，返回任务列表
      router.push('/');
    }
  }

  function backToList() {
    router.push('/');
  }

  onMounted(async () => {
    unlisten = await onPomodoroStateUpdate(apply);
    const init = await getPomodoroState();
    apply(init);
  });

  onBeforeUnmount(() => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  });
</script>

<style scoped>
  .timer-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
  }

  .timer-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .task-title {
    font-size: 20px;
    font-weight: 600;
    color: #555;
    margin: 0;
  }

  .timer {
    position: relative;
    width: 200px;
    height: 200px;
  }

  .progress-ring__track {
    transition: stroke-dashoffset 0.2s;
  }

  .progress-ring__circle {
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
    transition: stroke-dashoffset 0.5s linear;
  }

  .time-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 48px;
    font-weight: bold;
    color: #ff6347;
  }

  .completed-panel {
    text-align: center;
    min-height: 90px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .done-tip {
    font-size: 22px;
    font-weight: 600;
    color: #389e0d;
    margin: 0;
  }

  .reward {
    font-size: 18px;
    color: #d48806;
    margin: 0;
  }

  .buttons {
    display: flex;
    gap: 12px;
  }

  .buttons button {
    background-color: #ff6347;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }

  .buttons button:hover {
    background-color: #e55347;
  }

  .resume-hint {
    color: #999;
    font-size: 13px;
    margin: 0;
  }
</style>
