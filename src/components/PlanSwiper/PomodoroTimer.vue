<template>
  <a-layout class="layout">
    <a-layout-content
      style="display: flex; justify-content: center; align-items: center; height: 100vh"
    >
      <div class="timer-container" style="text-align: center">
        <!-- Timer Display with Circular Progress Bar -->
        <div class="timer-display">
          <p>{{ $route.params.taskName }}</p>
          <div class="timer">
            <svg class="progress-ring" width="200" height="200">
              <circle
                class="progress-ring__circle"
                stroke="#ff6347"
                stroke-width="8"
                fill="transparent"
                r="90"
                cx="100"
                cy="100"
              />
            </svg>
            <span>{{ formattedTime }}</span>
          </div>
        </div>

        <!-- Tomato Icons (Pomodoro)：已完成红色番茄 + 剩余浅色番茄 -->
        <div class="rate-container" style="justify-content: center">
          <div v-for="n in Number($route.params.totalPomodoros)" :key="n">
            <img
              :src="n <= completedCount ? ColorTomatoIcon : LightTomatoIcon"
              class="tomato-icon"
            />
          </div>
        </div>

        <!-- Timer Control Buttons -->
        <div class="buttons">
          <button @click="startTimer" v-if="!isRunning && !isPaused">Start</button>
          <button @click="pauseTimer" v-if="isRunning">Pause</button>
          <button @click="continueTimer" v-if="!isRunning && isPaused">Continue</button>
          <button @click="endTimer" v-if="!isRunning && isPaused">End</button>
        </div>
      </div>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';
  import { useRoute } from 'vue-router';
  import dayjs from 'dayjs';
  import { getRepository } from '@/api';
  import { useSettingsStore } from '@/stores/settingsStore';

  import ColorTomatoIcon from '@/assets/images/red_clock.svg';
  import LightTomatoIcon from '@/assets/images/light_tomato.svg';

  const route = useRoute();
  const taskId = Number(route.params.id);

  const repo = getRepository();
  const settings = useSettingsStore();
  settings.load();

  const minutes = ref(settings.workMinutes);
  const seconds = ref(0);
  const isRunning = ref(false);
  const isPaused = ref(false);
  const completedCount = ref(0);
  let timerInterval = null;
  let sessionStart = null; // 当前番茄开始时间
  const totalTime = computed(() => settings.workMinutes * 60); // 单个番茄总时长（秒）

  // 已完成番茄数（来自 pomodoro_records，按当日统计）
  onMounted(async () => {
    updateProgress();
    if (!Number.isNaN(taskId)) {
      try {
        const counts = await repo.countCompletedPomodoros([taskId]);
        completedCount.value = counts[taskId] ?? 0;
      } catch (error) {
        console.log('加载番茄记录失败:', error);
      }
    }
  });

  // 完成一个番茄：写入 pomodoro_records
  async function saveCompletedRecord() {
    if (Number.isNaN(taskId)) return;
    const end = new Date();
    try {
      await repo.createPomodoroRecord({
        task_id: taskId,
        record_date: dayjs().format('YYYY-MM-DD'),
        start_time: sessionStart ? sessionStart.toISOString() : end.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: settings.workMinutes,
        status: 'completed',
      });
      completedCount.value += 1;
    } catch (error) {
      console.log('保存番茄记录失败:', error);
    }
  }

  // 中途结束：写入中断记录（满 1 分钟才记录）
  async function saveInterruptedRecord() {
    if (Number.isNaN(taskId) || !sessionStart) return;
    const elapsedMinutes = Math.floor((Date.now() - sessionStart.getTime()) / 60000);
    if (elapsedMinutes < 1) return;
    try {
      await repo.createPomodoroRecord({
        task_id: taskId,
        record_date: dayjs().format('YYYY-MM-DD'),
        start_time: sessionStart.toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: elapsedMinutes,
        status: 'interrupted',
      });
    } catch (error) {
      console.log('保存番茄记录失败:', error);
    }
  }

  const formattedTime = computed(() => {
    return `${minutes.value.toString().padStart(2, '0')}:${seconds.value
      .toString()
      .padStart(2, '0')}`;
  });

  const timeRemaining = computed(() => {
    return minutes.value * 60 + seconds.value;
  });

  const progress = computed(() => {
    return (timeRemaining.value / totalTime) * 100;
  });

  const startTimer = () => {
    isRunning.value = true;
    isPaused.value = false;
    if (!sessionStart) {
      sessionStart = new Date();
    }
    timerInterval = setInterval(() => {
      if (seconds.value === 0) {
        if (minutes.value === 0) {
          clearInterval(timerInterval);
          isRunning.value = false;
          saveCompletedRecord();
          sessionStart = null;
          // 重置计时器，便于开始下一个番茄
          minutes.value = settings.workMinutes;
          seconds.value = 0;
          updateProgress();
          alert('Pomodoro Completed!');
          return;
        }
        minutes.value--;
        seconds.value = 59;
      } else {
        seconds.value--;
      }
      updateProgress();
    }, 1000);
  };

  const pauseTimer = () => {
    isRunning.value = false;
    isPaused.value = true;
    clearInterval(timerInterval);
  };

  const continueTimer = () => {
    startTimer();
  };

  const endTimer = () => {
    isRunning.value = false;
    isPaused.value = false;
    clearInterval(timerInterval);
    saveInterruptedRecord();
    sessionStart = null;
    minutes.value = settings.workMinutes;
    seconds.value = 0;
    updateProgress();
  };

  const updateProgress = () => {
    const circle = document.querySelector('.progress-ring__circle');
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress.value / 100) * circumference;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = offset;
  };

  onMounted(() => {
    updateProgress();
  });
</script>

<style scoped>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Arial, sans-serif;
    background-color: #f0f0f0;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    flex-direction: column;
  }

  .rate-container {
    display: flex;
    gap: 8px;
  }

  .timer-display {
    margin-bottom: 30px;
    position: relative;
  }

  .timer p {
    font-size: 18px;
    color: #555;
  }

  .timer span {
    font-size: 48px;
    font-weight: bold;
    color: #ff6347; /* Tomato red color */
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .progress-ring {
    position: relative;
    width: 200px;
    height: 200px;
  }

  .progress-ring__circle {
    transition: stroke-dashoffset 0.35s;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;
  }

  .tomato-container {
    margin-bottom: 30px;
  }

  .tomato-icon {
    width: 22px;
    height: 22px;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .buttons button {
    background-color: #ff6347;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.3s ease;
    margin: 5px;
  }

  .buttons button:hover {
    background-color: #e55347;
  }

  .buttons button:focus {
    outline: none;
  }
</style>
