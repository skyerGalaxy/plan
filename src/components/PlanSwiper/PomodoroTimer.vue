<template>
  <a-layout class="layout">
    <a-layout-content
      style="display: flex; justify-content: center; align-items: center; height: 100vh"
    >
      <div class="timer-container">
        <!-- Timer Display with Circular Progress Bar -->
        <div class="timer-display">
          <p>Current Task</p>
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

        <!-- Tomato Icons (Pomodoro) -->
        <div class="tomato-container">
          <span class="tomato" v-for="n in pomodoros" :key="n">&#127813;</span>
        </div>

        <!-- Timer Control Buttons -->
        <div class="buttons">
          <button @click="startTimer" v-if="!isRunning">Start</button>
          <button @click="pauseTimer" v-if="isRunning">Pause</button>
          <button @click="resetTimer">Reset</button>
        </div>
      </div>
    </a-layout-content>
  </a-layout>
</template>

<script setup>
  import { ref, computed, onMounted } from 'vue';

  const minutes = ref(25);
  const seconds = ref(0);
  const isRunning = ref(false);
  const pomodoros = ref(3); // Adjust the number of completed pomodoros
  let timerInterval = null;
  const totalTime = 25 * 60; // Total time in seconds

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
    timerInterval = setInterval(() => {
      if (seconds.value === 0) {
        if (minutes.value === 0) {
          clearInterval(timerInterval);
          isRunning.value = false;
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
    clearInterval(timerInterval);
  };

  const resetTimer = () => {
    isRunning.value = false;
    clearInterval(timerInterval);
    minutes.value = 25;
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

  .timer-container {
    text-align: center;
    padding: 40px;
    width: 300px;
    display: flex;
    flex-direction: column;
    justify-content: center;
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

  .tomato {
    font-size: 30px;
    color: #ff6347;
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
