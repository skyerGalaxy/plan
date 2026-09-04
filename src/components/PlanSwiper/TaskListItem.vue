<script lang="ts" setup>
  import { usePlanerStore } from '@/stores/planStore';
  import {
    PlayCircleTwoTone,
    ClockCircleOutlined,
    FlagOutlined,
    SyncOutlined,
  } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';
  import LoopRuleModal from './LoopRuleModal.vue';
  import { ref, computed } from 'vue';
  import { getRepository, countRuleOccurrences } from '@/api';
  import { message, Modal } from 'ant-design-vue';
  import { startPomodoro, interruptSavePomodoro, getPomodoroState } from '@/api/pomodoro';

  const props = defineProps({
    item: {
      type: Object,
      required: true,
    },
  });

  const planStore = usePlanerStore();
  const emit = defineEmits(['open-modal', 'delete-task']);

  // 番茄钟设定配额：循环任务按单次 pomodoro_per_occurrence 计，普通任务按 total_pomodoro_quota 计
  const pomodoroTarget = computed(() =>
    props.item.is_cyclic === 1
      ? props.item.pomodoro_per_occurrence || props.item.total_pomodoro_quota
      : props.item.total_pomodoro_quota
  );

  // 该任务已完成番茄数（由数据层/父级附带 finished_pomodoro）
  const finishedPomodoro = computed(() => props.item.finished_pomodoro || 0);

  // 已完成数未达设定配额时才可进入番茄钟开始专注
  const canStartPomodoro = computed(() => finishedPomodoro.value < pomodoroTarget.value);

  // 开始番茄钟：调用后端命令；若已有其它任务进行中则弹窗确认切换
  const handleStartPomodoro = async () => {
    try {
      await startPomodoro(props.item.id, props.item.occurrence_date ?? null);
    } catch (error: any) {
      // 后端返回单例冲突（已有其它任务 running/paused）
      const current = await getPomodoroState();
      const currentTitle = current?.task_title || '另一个任务';
      Modal.confirm({
        title: '已有进行中的番茄钟',
        content: `当前「${currentTitle}」正在专注中。结束它并切换到「${props.item.title}」吗？`,
        okText: '切换',
        cancelText: '取消',
        async onOk() {
          await interruptSavePomodoro().catch(() => {});
          await startPomodoro(props.item.id, props.item.occurrence_date ?? null);
        },
      });
    }
  };

  const handleOpenModal = () => {
    // 循环任务只能删除，禁止打开编辑弹窗
    if (props.item.is_cyclic === 1) return;
    emit('open-modal', props.item);
  };

  const handleMenuClick = async ({ key }: { key: string }) => {
    switch (key) {
      case 'delete':
        // 处理删除任务：仅删除自身及子孙中未执行的任务，已执行的予以保留
        try {
          const result = await getRepository().deleteTask(props.item.id);
          if (result.blocked.length > 0) {
            message.warning(
              `已删除${result.deleted.length}个任务，另有${result.blocked.length}个任务因已执行（存在番茄记录）被保留`
            );
          } else {
            message.success(`已删除${result.deleted.length}个任务`);
          }
          // 更新当前视图及下层视图（后续各视图均按需重新拉取）
          planStore.isQuarterDataChanged = true;
          planStore.isMonthDataChanged = true;
          planStore.isWeekDataChanged = true;
          planStore.isDayDataChanged = true;
          emit('delete-task', props.item.id);
        } catch (error: any) {
          console.log('删除任务失败:', error);
          message.error(error?.message || '删除任务失败');
        }
        break;
    }
  };

  const dropdownVisible = ref(false);

  // 季月周视图：循环任务栏的循环规则按钮
  const loopOpen = ref(false);
  const loopRule = ref<string | null>(props.item.cycle_rule || null);

  const openLoopRule = () => {
    loopRule.value = props.item.cycle_rule || null;
    loopOpen.value = true;
  };

  // 标记数据已变更，触发 store 刷新。按任务自身层级标记，
  // 保证在子视图修改继承的上级循环任务也能正确联动刷新。
  const markDataChanged = () => {
    switch (props.item.period_type) {
      case 1:
        planStore.isQuarterDataChanged = true;
        break;
      case 2:
        planStore.isMonthDataChanged = true;
        break;
      case 3:
        planStore.isWeekDataChanged = true;
        break;
      case 4:
        planStore.isDayDataChanged = true;
        break;
    }
  };

  // 循环规则确认后直接更新任务
  const onLoopRuleChange = async (rule: string | null) => {
    loopRule.value = rule;
    try {
      // 修改循环规则后，同步重算总番茄配额 = 单次番茄数 × 新规则在任务周期内触发次数
      const occurrenceCount = countRuleOccurrences(
        rule,
        props.item.start_date,
        props.item.end_date
      );
      await getRepository().updateTask(props.item.id, {
        is_cyclic: rule ? 1 : 0,
        cycle_rule: rule,
        pomodoro_per_occurrence: rule ? props.item.pomodoro_per_occurrence || 0 : 0,
        total_pomodoro_quota: rule
          ? (props.item.pomodoro_per_occurrence || 0) * occurrenceCount
          : 0,
      });
      markDataChanged();
    } catch (error) {
      console.log('更新循环规则失败:', error);
    }
  };
</script>

<template>
  <template v-if="planStore.cycleValue === 4">
    <a-dropdown
      v-model:open="dropdownVisible"
      :trigger="['contextmenu']"
      :trigger-on-click="false"
      placement="bottomLeft"
      class="full-width"
    >
      <a-list-item class="task-card" @click="handleOpenModal">
        <template #actions>
          <div class="task-actions">
            <div class="actions-container">
              <RangeButton :range="props.item.sort_order" :disable="true" />
              <PomodoroCounter
                :total-pomodoro="pomodoroTarget"
                :finishedPomodoro="finishedPomodoro"
                readonly
              />
            </div>
          </div>
        </template>
        <a-list-item-meta>
          <template #title>
            <div class="task-title">
              <span class="title-text">{{ props.item.title }}</span>
              <span v-if="props.item.is_cyclic === 1" class="loop-icon" @click.stop="openLoopRule">
                <SyncOutlined />
              </span>
            </div>
          </template>
          <template #avatar>
            <a-avatar v-if="canStartPomodoro" @click.stop="handleStartPomodoro">
              <PlayCircleTwoTone twoToneColor="#52c41a" style="font-size: 20px" />
            </a-avatar>
          </template>
        </a-list-item-meta>
      </a-list-item>
      <template #overlay>
        <a-menu @click="handleMenuClick">
          <a-menu-item key="delete">
            <span class="icon">🗑️</span>
            删除任务
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </template>
  <template v-else>
    <a-dropdown
      v-model:open="dropdownVisible"
      :trigger="['contextmenu']"
      :trigger-on-click="false"
      placement="bottomCenter"
      class="full-width"
    >
      <a-list-item class="task-card" @click="handleOpenModal">
        <a-list-item-meta>
          <template #title>
            <div class="task-content">
              <span style="margin-right: auto">{{ props.item.title }}</span>
              <span v-if="props.item.is_cyclic === 1" class="loop-icon" @click.stop="openLoopRule">
                <SyncOutlined />
              </span>
              <RangeButton :range="props.item.sort_order" :disable="true" />
            </div>
          </template>
        </a-list-item-meta>
      </a-list-item>
      <template #overlay>
        <a-menu @click="handleMenuClick">
          <a-menu-item key="delete">
            <span class="icon">🗑️</span>
            删除任务
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </template>

  <LoopRuleModal
    v-model:open="loopOpen"
    :rule="loopRule"
    :period-type="props.item.period_type || planStore.cycleValue"
    :start-date="props.item.start_date"
    readonly
    @update:rule="onLoopRuleChange"
  />
</template>

<style scoped>
  .full-width {
    width: 100%;
  }

  .task-card {
    cursor: pointer;
  }

  .task-actions {
    display: flex;
    justify-content: flex-end;
  }

  .actions-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-title {
    cursor: pointer;
    display: flex;
    align-items: center;
    max-width: 100%;
    overflow: hidden;
  }

  .title-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loop-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #1677ff;
    font-size: 15px;
    padding: 0 2px;
    transition: opacity 0.2s;
  }

  .loop-icon:hover {
    opacity: 0.7;
  }

  .task-content {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
