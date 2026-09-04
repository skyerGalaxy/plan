<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useSettingsStore } from '@/stores/settingsStore';
  import {
    SettingOutlined,
    ClockCircleOutlined,
    InfoCircleOutlined,
    QuestionCircleOutlined,
    ReloadOutlined,
    SaveOutlined,
  } from '@ant-design/icons-vue';
  import { message } from 'ant-design-vue';
  import dayjs from 'dayjs';

  const settings = useSettingsStore();

  const activeKey = ref<string>('general');
  const saving = ref(false);

  // 「点击关闭按钮」策略选项
  const closeToTrayOptions = [
    { label: '最小化到系统托盘', value: true },
    { label: '退出应用', value: false },
  ];

  // 番茄钟表单本地草稿：修改后仅停留在草稿，点击「保存修改」才落库
  const pomoForm = reactive({
    dailyPomodoroCount: 8, // 每日专注目标（user_pomo_schedule）
    workMinutes: 25, // 专注时长（分钟，user_pomo_schedule）
    shortBreakMinutes: 5, // 短休息时长（app_settings）
    longBreakMinutes: 15, // 长休息时长（app_settings）
    longBreakInterval: 4, // 长休息间隔（app_settings）
    autoStartBreak: true, // 自动开始休息（app_settings）
    forceBreakScreen: true, // 强制休息界面（app_settings）
    autoStartWork: false, // 自动开始专注（app_settings）
    workStartReminder: false, // 专注开始提醒（app_settings）
    focusMode: false, // 专注模式：开启后显示桌面宠物窗口（app_settings）
  });
  // 已保存快照：用于脏检查与重置
  const pomoOriginal = ref<Record<string, unknown>>({});

  const pomoDirty = computed(() =>
    (Object.keys(pomoForm) as (keyof typeof pomoForm)[]).some(
      k => pomoForm[k] !== pomoOriginal.value[k]
    )
  );

  // ---- 时间预览 ----
  const dailyAvailableMinutes = computed(
    () => (pomoForm.dailyPomodoroCount || 0) * (pomoForm.workMinutes || 0)
  );
  const yearlyRemainingMinutes = computed(() => {
    const today = dayjs();
    const remainingDays = today.endOf('year').diff(today, 'day') + 1;
    return remainingDays * dailyAvailableMinutes.value;
  });
  const dailyAvailableText = computed(() => formatMinutes(dailyAvailableMinutes.value));
  const yearlyRemainingText = computed(() => formatMinutes(yearlyRemainingMinutes.value));

  function formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h} 小时 ${m} 分钟`;
    if (h > 0) return `${h} 小时`;
    return `${m} 分钟`;
  }

  /** 主窗口关闭行为（最小化到托盘 / 退出应用）变更即持久化 */
  function onCloseToTrayChange(e: { target: { value: boolean } }) {
    settings.set('settings.closeToTray', e.target.value);
  }

  function snapshotPomo() {
    pomoOriginal.value = JSON.parse(JSON.stringify(pomoForm));
  }

  /** 重置：草稿恢复为已保存的原始数据，并立即清理脏值状态 */
  function resetPomo() {
    Object.assign(pomoForm, pomoOriginal.value);
    snapshotPomo();
  }

  /** 保存：时段配置写入 user_pomo_schedule（关旧段+新增段），其余写入 app_settings */
  async function savePomo() {
    if (!pomoDirty.value) return;
    saving.value = true;
    try {
      // 时段配置（每日数量 + 专注时长）仅在实际修改时才生成新配置段
      const scheduleChanged =
        pomoForm.dailyPomodoroCount !== pomoOriginal.value.dailyPomodoroCount ||
        pomoForm.workMinutes !== pomoOriginal.value.workMinutes;
      if (scheduleChanged) {
        settings.dailyPomodoroTarget = pomoForm.dailyPomodoroCount;
        settings.workMinutes = pomoForm.workMinutes;
        await settings.saveSchedule();
      }
      // 全局配置 → app_settings
      settings.shortBreakMinutes = pomoForm.shortBreakMinutes;
      settings.longBreakMinutes = pomoForm.longBreakMinutes;
      settings.longBreakInterval = pomoForm.longBreakInterval;
      settings.autoStartBreak = pomoForm.autoStartBreak;
      settings.forceBreakScreen = pomoForm.forceBreakScreen;
      settings.autoStartWork = pomoForm.autoStartWork;
      settings.workStartReminder = pomoForm.workStartReminder;
      await Promise.all([
        settings.set('settings.shortBreakMinutes', pomoForm.shortBreakMinutes),
        settings.set('settings.longBreakMinutes', pomoForm.longBreakMinutes),
        settings.set('settings.longBreakInterval', pomoForm.longBreakInterval),
        settings.set('settings.autoStartBreak', pomoForm.autoStartBreak),
        settings.set('settings.forceBreakScreen', pomoForm.forceBreakScreen),
        settings.set('settings.autoStartWork', pomoForm.autoStartWork),
        settings.set('settings.workStartReminder', pomoForm.workStartReminder),
      ]);
      // 专注模式：持久化并同步后端窗口显隐
      await settings.setFocusMode(pomoForm.focusMode);
      snapshotPomo();
      message.success('番茄钟设置已保存');
    } catch (e) {
      console.error('保存番茄钟设置失败', e);
      message.error('保存失败，请重试');
    } finally {
      saving.value = false;
    }
  }

  onMounted(async () => {
    await settings.load();
    Object.assign(pomoForm, {
      dailyPomodoroCount: settings.dailyPomodoroTarget,
      workMinutes: settings.workMinutes,
      shortBreakMinutes: settings.shortBreakMinutes,
      longBreakMinutes: settings.longBreakMinutes,
      longBreakInterval: settings.longBreakInterval,
      autoStartBreak: settings.autoStartBreak,
      forceBreakScreen: settings.forceBreakScreen,
      autoStartWork: settings.autoStartWork,
      workStartReminder: settings.workStartReminder,
      focusMode: settings.focusMode,
    });
    snapshotPomo();
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

          <a-form-item label="隐藏已完成任务">
            <a-switch
              v-model:checked="settings.hideCompleted"
              @change="(v: boolean) => settings.set('settings.hideCompleted', v)"
            />
            <div class="form-hint">在计划列表默认隐藏已经完成的任务</div>
          </a-form-item>

          <a-form-item label="点击关闭按钮时">
            <a-radio-group
              v-model:value="settings.closeToTray"
              :options="closeToTrayOptions"
              @change="onCloseToTrayChange"
            />
            <div class="form-hint">
              {{ settings.closeToTray ? '最小化到系统托盘（可通过托盘图标恢复）' : '直接退出应用' }}
            </div>
          </a-form-item>
        </a-form>
      </div>

      <!-- 番茄钟设置 -->
      <div v-if="activeKey === 'pomodoro'" class="settings-panel">
        <h3 class="panel-title">番茄钟设置</h3>

        <!-- 时间预览窗口 -->
        <div class="preview-card">
          <div class="preview-item">
            <div class="preview-label">每日可用时长</div>
            <div class="preview-value">{{ dailyAvailableText }}</div>
            <div class="preview-note">
              {{ pomoForm.dailyPomodoroCount }} × {{ pomoForm.workMinutes }} 分钟
            </div>
          </div>
          <div class="preview-divider"></div>
          <div class="preview-item">
            <div class="preview-label">年度剩余可用时长</div>
            <div class="preview-value">{{ yearlyRemainingText }}</div>
            <div class="preview-note">至 {{ dayjs().endOf('year').format('YYYY-MM-DD') }}</div>
          </div>
        </div>
        <div v-if="settings.activeSchedule" class="schedule-hint">
          当前配置自 {{ settings.activeSchedule.start_date }} 起生效，修改并保存后将从今日启用新配置
        </div>

        <!-- 专注计划（user_pomo_schedule） -->
        <h4 class="section-title">专注计划</h4>
        <a-form layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
          <a-form-item label="每日专注目标">
            <a-input-number v-model:value="pomoForm.dailyPomodoroCount" :min="1" :max="30" />
            <a-tooltip title="每天计划完成的番茄钟个数，用于统计完成度与预估每日专注时长">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="专注时长（分钟）">
            <a-input-number v-model:value="pomoForm.workMinutes" :min="1" :max="120" />
            <a-tooltip title="单个番茄钟的专注时长，修改后从今日起按新时长执行">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>
        </a-form>

        <a-divider class="section-divider" />

        <!-- 休息与提醒（app_settings） -->
        <h4 class="section-title">休息与提醒</h4>
        <a-form layout="horizontal" :label-col="{ span: 8 }" :wrapper-col="{ span: 16 }">
          <a-form-item label="短休息时长">
            <a-input-number v-model:value="pomoForm.shortBreakMinutes" :min="1" :max="60" />
            <a-tooltip title="完成一个番茄后的短休息时长">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="长休息时长">
            <a-input-number v-model:value="pomoForm.longBreakMinutes" :min="5" :max="120" />
            <a-tooltip title="完成一轮番茄后的长休息时长">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="长休息间隔">
            <a-input-number v-model:value="pomoForm.longBreakInterval" :min="2" :max="10" />
            <a-tooltip title="每完成 N 个工作番茄后进入一次长休息">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="自动开始休息">
            <a-switch v-model:checked="pomoForm.autoStartBreak" />
            <a-tooltip title="完成一个番茄后自动进入休息倒计时，无需手动点击开始">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="强制休息提醒">
            <a-switch v-model:checked="pomoForm.forceBreakScreen" />
            <a-tooltip title="休息期间打开全屏强制休息界面，避免休息时继续工作">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="自动开始专注">
            <a-switch v-model:checked="pomoForm.autoStartWork" />
            <a-tooltip title="休息结束后自动开始下一个番茄，无需手动操作">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="专注开始提醒">
            <a-switch v-model:checked="pomoForm.workStartReminder" />
            <a-tooltip title="开始工作时打开工作开始提醒界面，提示你进入专注状态">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>

          <a-form-item label="专注模式（桌面宠物）">
            <a-switch v-model:checked="pomoForm.focusMode" />
            <a-tooltip title="开启后，开始番茄钟时自动在屏幕右下角显示桌面宠物窗口；结束后自动隐藏">
              <QuestionCircleOutlined class="tip-icon" />
            </a-tooltip>
          </a-form-item>
        </a-form>

        <!-- 操作栏：仅在存在未保存修改时显示重置与保存，保存/重置后隐藏 -->
        <div class="pomo-actions">
          <a-button v-if="pomoDirty" type="primary" :loading="saving" @click="savePomo">
            <template #icon><SaveOutlined /></template>
            保存修改
          </a-button>
          <a-button v-if="pomoDirty" :disabled="saving" @click="resetPomo">
            <template #icon><ReloadOutlined /></template>
            重置
          </a-button>
        </div>
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

  /* 时间预览窗口 */
  .preview-card {
    display: flex;
    align-items: stretch;
    background: linear-gradient(135deg, #f6f9ff 0%, #eef3ff 100%);
    border: 1px solid #d6e4ff;
    border-radius: 10px;
    padding: 16px 24px;
    margin-bottom: 12px;
  }

  .preview-item {
    flex: 1;
    min-width: 0;
  }

  .preview-divider {
    width: 1px;
    background: #d6e4ff;
    margin: 0 24px;
  }

  .preview-label {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.55);
    margin-bottom: 6px;
  }

  .preview-value {
    font-size: 24px;
    font-weight: 600;
    color: #1677ff;
    line-height: 1.2;
    margin-bottom: 6px;
  }

  .preview-note {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.4);
  }

  .schedule-hint {
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    margin: 0 0 20px 2px;
  }

  /* 分区标题 */
  .section-title {
    font-size: 15px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.88);
    margin: 8px 0 20px;
  }

  .section-divider {
    margin: 28px 0;
  }

  /* 问号 tooltip 图标 */
  .tip-icon {
    margin-left: 8px;
    color: rgba(0, 0, 0, 0.35);
    cursor: help;
  }

  .tip-icon:hover {
    color: #1677ff;
  }

  /* 操作栏 */
  .pomo-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 12px;
    padding-top: 20px;
    border-top: 1px solid #f0f0f0;
  }
</style>
