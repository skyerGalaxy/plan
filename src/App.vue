<script lang="ts" setup>
  import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { getRepository } from '@/api';
  import { onPomodoroStateUpdate, onPomodoroRecordSync, type UnlistenFn } from '@/api/pomodoro';
  import planlogeLight from './assets/images/plan_light.svg';
  import staticLight from './assets/images/statistics_light.svg';
  import personLight from './assets/images/profile_light.svg';

  const selectedKeys = ref<string[]>(['1']);
  const router = useRouter();
  const route = useRoute();

  // 番茄钟状态全局导航：running 自动切入番茄钟页；中断保存自动返回任务列表
  let pomodoroUnlisten: UnlistenFn | null = null;
  // 后端番茄记录写库后同步到云端（幂等 upsert）
  let recordSyncUnlisten: UnlistenFn | null = null;
  onMounted(async () => {
    pomodoroUnlisten = await onPomodoroStateUpdate(payload => {
      if (payload.status === 'running' && route.path !== '/pomodoro') {
        router.push('/pomodoro');
      } else if (payload.status === 'interrupted_saved' && route.path === '/pomodoro') {
        router.push('/');
      }
    });
    recordSyncUnlisten = await onPomodoroRecordSync(payload => {
      getRepository()
        .upsertPomodoroRecord(payload)
        .catch(e => console.error('番茄记录同步失败', payload?.id, e));
    });
  });
  onBeforeUnmount(() => {
    if (pomodoroUnlisten) {
      pomodoroUnlisten();
      pomodoroUnlisten = null;
    }
    if (recordSyncUnlisten) {
      recordSyncUnlisten();
      recordSyncUnlisten = null;
    }
  });

  const routeKeyMap: Record<string, string> = {
    '/': '1',
    '/statistics': '2',
    '/person': '3',
    '/settings': '4',
    '/pomodoro': '1',
  };

  // 路由变化时同步高亮
  watch(
    () => route.path,
    path => {
      selectedKeys.value = [routeKeyMap[path] ?? '1'];
    },
    { immediate: true }
  );

  const handleMenuClick = (key: string) => {
    selectedKeys.value = [key];
    switch (key) {
      case '1':
        router.push('/');
        break;
      case '2':
        router.push('/statistics');
        break;
      case '3':
        router.push('/person');
        break;
      case '4':
        router.push('/settings');
        break;
    }
  };
</script>

<template>
  <a-layout style="height: 100vh; overflow: hidden">
    <a-layout-header
      style="height: 60px; background: #fff; display: flex; align-items: center; padding-left: 20px"
    >
      <img
        alt="logo"
        style="height: 40px; width: 40px; border-radius: 50%"
        src="./assets/images/logo.png"
      />
    </a-layout-header>
    <a-layout-content style="flex: 1; min-height: 0; overflow: hidden">
      <a-layout style="height: 100%; min-height: 0">
        <a-layout-sider width="80" theme="light">
          <div class="logo" style="margin-top: 20px">
            <a-menu v-model:selectedKeys="selectedKeys" theme="light" mode="inline">
              <a-menu-item
                key="1"
                @click="handleMenuClick('1')"
                style="margin-bottom: 25px; display: flex; justify-content: center"
              >
                <img :src="planlogeLight" alt="logo" style="width: 35px; height: 35px" />
              </a-menu-item>
              <a-menu-item
                key="2"
                @click="handleMenuClick('2')"
                style="margin-bottom: 25px; display: flex; justify-content: center"
              >
                <img :src="staticLight" alt="logo" style="width: 35px; height: 35px" />
              </a-menu-item>
              <a-menu-item
                key="3"
                @click="handleMenuClick('3')"
                style="margin-bottom: 25px; display: flex; justify-content: center"
              >
                <img :src="personLight" alt="logo" style="width: 35px; height: 35px" />
              </a-menu-item>
              <a-menu-item
                key="4"
                @click="handleMenuClick('4')"
                style="display: flex; justify-content: center"
                :style="{ marginBottom: '0px' }"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  style="color: rgba(0, 0, 0, 0.65)"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                  ></path>
                </svg>
              </a-menu-item>
            </a-menu>
          </div>
        </a-layout-sider>
        <a-layout-content :style="{ padding: '24px 16px 0', overflow: 'hidden' }">
          <router-view></router-view>
        </a-layout-content>
      </a-layout>
    </a-layout-content>
  </a-layout>
</template>
