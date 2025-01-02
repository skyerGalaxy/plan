<script lang="ts" setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import planlogeLight from './assets/plan_light.svg';
import staticLight from './assets/statistics_light.svg';
import personLight from './assets/profile_light.svg';

const selectedKeys = ref<string[]>(['1']);
const router = useRouter();

const handleMenuClick = (key: string) => {
  selectedKeys.value = [key];
  switch (key) {
    case '1':
      router.push('/');
      break;
    case '2':
      router.push('/statis');
      break;
    case '3':
      router.push('/person');
      break;
  }
};
</script>

<template>
  <a-layout style="max-height: 80vh;">
    <a-layout-header style="height: 60px; background: #fff; display: flex; align-items: center; padding-left: 20px;">
      <img alt="logo" style="height: 40px; width: 40px; border-radius: 50%;" src="./assets/logo.png" />
    </a-layout-header>
    <a-layout-content>
        <a-layout >
          <a-layout-sider width="80" theme="light">
            <div class="logo" style="margin-top: 20px;">
              <a-menu v-model:selectedKeys="selectedKeys" theme="light" mode="inline">
              <a-menu-item key="1" @click="handleMenuClick('1')" style="margin-bottom: 25px; display: flex; justify-content: center;">
                <img :src="planlogeLight" alt="logo" style="width: 35px; height: 35px;" />
              </a-menu-item>
              <a-menu-item key="2" @click="handleMenuClick('2')" style="margin-bottom: 25px; display: flex; justify-content: center;">
                <img :src="staticLight" alt="logo" style="width: 35px; height: 35px;" />
              </a-menu-item>
              <a-menu-item key="3" @click="handleMenuClick('3')" style="margin-bottom: 25px; display: flex; justify-content: center;">
                <img :src="personLight" alt="logo" style="width: 35px; height: 35px;" />
              </a-menu-item>
              </a-menu>
            </div>
          </a-layout-sider>
          <a-layout-content :style="{ margin: '24px 16px 0' }">
            <router-view></router-view>
          </a-layout-content>
        </a-layout>
      </a-layout-content>
  </a-layout>
</template>

<style scoped>
#components-layout-demo-responsive .logo {
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  margin: 16px;
}

.site-layout-sub-header-background {
  background: #fff;
}

.site-layout-background {
  background: #fff;
}

[data-theme='dark'] .site-layout-sub-header-background {
  background: #141414;
}
</style>
