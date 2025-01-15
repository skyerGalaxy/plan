import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';
import { SwipeCell } from 'vant';
import App from './App.vue'
import router from './router'


import { register } from 'swiper/element/bundle';
import { getCurrentDate } from './utils/getCurrentDate';
register()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

getCurrentDate()

app.use(Antd).use(SwipeCell).mount('#app');
