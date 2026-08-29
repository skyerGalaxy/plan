<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useSettingsStore } from '@/stores/settingsStore';
  import { SettingOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons-vue';

  const settings = useSettingsStore();

  const activeKey = ref<string>('general');

  onMounted(() => {
    settings.load();
  });

  // 通用设置项行组件结构：label + slot
  const menuItems = [
    { key: 'general', label: '常规设置', icon: SettingOutlined },
    { key: 'pomodoro', label: '番茄钟设置', icon: ClockCircleOutlined },
    { key: 'about', label: '关于', icon: InfoCircleOutlined },
  ];

  const weekOptions = [
    { label: '周一', value: 1 },
    { label: '周日', value: 0 },
  ];
</script>

<template>
  <a-layout class="settings-layout">
    <a-layout-sider width="200" theme="light" class="settings-sider">
      <a-menu
        :selectedKeys="[activeKey]"
        @update:selectedKeys="(k: string[]) => (activeKey = k[k.length - 1] ?? activeKey)"
        mode="inline"
        theme="light"
        class="settings-menu"
      >
        <a-menu-item v-for="item in menuItems" :key="item.key" @click="activeKey = item.key">
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout-content class="settings-content">
      <!-- 常规设置 -->
      <div v-if="activeKey === 'general'" class="settings-panel">
        <h3 class="panel-title">常规设置</h3>
        <a-form layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
          <a-form-item label="默认任务周期">
            <a-select
              v-model:value="settings.defaultCycle"
              style="width: 200px"
              @change="(v: number) => settings.set('settings.defaultCycle', v)"
            >
              <a-select-option :value="1">季度视图</a-select-option>
              <a-select-option :value="2">月度视图</a-select-option>
              <a-select-option :value="3">周视图</a-select-option>
              <a-select-option :value="4">日视图</a-select-option>
            </a-select>
            <div class="form-hint">进入计划页时默认显示的周期视图</div>
          </a-form-item>

          <a-form-item label="一周起始日">
            <a-select
              v-model:value="settings.weekStartsOn"
              style="width: 200px"
              @change="(v: number) => settings.set('settings.weekStartsOn', v)"
            >
              <a-select-option v-for="opt in weekOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="每日番茄目标">
            <a-input-number
              v-model:value="settings.dailyPomodoroTarget"
              :min="1"
              :max="30"
              @change="
                (v: number | null) => settings.set('settings.dailyPomodoroTarget', Number(v) || 8)
              "
            />
            <div class="form-hint">统计页用于衡量每日完成度的目标个数</div>
          </a-form-item>

          <a-form-item label="隐藏已完成任务">
            <a-switch
              v-model:checked="settings.hideCompleted"
              @change="(v: boolean) => settings.set('settings.hideCompleted', v)"
            />
            <div class="form-hint">在计划列表默认隐藏已经完成的任务</div>
          </a-form-item>
        </a-form>
      </div>

      <!-- 番茄钟设置 -->
      <div v-if="activeKey === 'pomodoro'" class="settings-panel">
        <h3 class="panel-title">番茄钟设置</h3>
        <a-form layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
          <a-form-item label="工作时长（分钟）">
            <a-input-number
              v-model:value="settings.workMinutes"
              :min="1"
              :max="120"
              @change="(v: number | null) => settings.set('settings.workMinutes', Number(v) || 25)"
            />
          </a-form-item>

          <a-form-item label="短休息时长（分钟）">
            <a-input-number
              v-model:value="settings.shortBreakMinutes"
              :min="1"
              :max="60"
              @change="
                (v: number | null) => settings.set('settings.shortBreakMinutes', Number(v) || 5)
              "
            />
          </a-form-item>

          <a-form-item label="长休息时长（分钟）">
            <a-input-number
              v-model:value="settings.longBreakMinutes"
              :min="5"
              :max="120"
              @change="
                (v: number | null) => settings.set('settings.longBreakMinutes', Number(v) || 15)
              "
            />
          </a-form-item>

          <a-form-item label="长休息间隔">
            <a-input-number
              v-model:value="settings.longBreakInterval"
              :min="2"
              :max="10"
              @change="
                (v: number | null) => settings.set('settings.longBreakInterval', Number(v) || 4)
              "
            />
            <div class="form-hint">每完成 N 个工作番茄后进入一次长休息</div>
          </a-form-item>

          <a-form-item label="自动开始休息">
            <a-switch
              v-model:checked="settings.autoStartBreak"
              @change="(v: boolean) => settings.set('settings.autoStartBreak', v)"
            />
            <div class="form-hint">完成一个番茄后自动进入休息倒计时</div>
          </a-form-item>

          <a-form-item label="自动开始工作">
            <a-switch
              v-model:checked="settings.autoStartWork"
              @change="(v: boolean) => settings.set('settings.autoStartWork', v)"
            />
            <div class="form-hint">休息结束后自动开始下一个番茄</div>
          </a-form-item>
        </a-form>
      </div>

      <!-- 关于 -->
      <div v-if="activeKey === 'about'" class="settings-panel">
        <h3 class="panel-title">关于</h3>
        <a-descriptions :column="1" bordered size="middle">
          <a-descriptions-item label="应用名称">Plan</a-descriptions-item>
          <a-descriptions-item label="版本">0.1.0</a-descriptions-item>
          <a-descriptions-item label="技术栈">
            Vue 3 + Ant Design Vue + Pinia + Tauri
          </a-descriptions-item>
          <a-descriptions-item label="数据存储">
            本地 SQLite / 云端 Supabase（自动切换）
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-layout-content>
  </a-layout>
</template>

<style scoped>
  .settings-layout {
    height: 100%;
    min-height: 0;
    background: #fff;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    overflow: hidden;
  }

  .settings-sider {
    border-right: 1px solid #f0f0f0;
  }

  .settings-menu {
    height: 100%;
    border-inline-end: none !important;
  }

  .settings-content {
    padding: 24px 32px;
    overflow-y: auto;
  }

  .settings-panel {
    max-width: 640px;
  }

  .panel-title {
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 24px;
    color: rgba(0, 0, 0, 0.88);
  }

  .form-hint {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: 4px;
  }
</style>
