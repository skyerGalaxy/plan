import './assets/styles/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import App from './App.vue';
import PetTimerWindow from './components/PlanSwiper/PetTimerWindow.vue';
import router from './router';

import { register } from 'swiper/element/bundle';
import { getCurrentDate } from './utils/getCurrentDate';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
register();

// 桌宠窗口复用同一 SPA 入口，按窗口标签分支渲染：pet → 仅桌宠，其余 → 主应用
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
let isPet = false;
try {
  isPet = inTauri && getCurrentWebviewWindow().label === 'pet';
} catch {
  isPet = false;
}

const app = createApp(isPet ? PetTimerWindow : App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

getCurrentDate().then(() => {
  app.use(Antd).mount('#app');
});
