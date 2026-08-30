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
  import { ref } from 'vue';
  import { getRepository } from '@/api';
  import { useRouter } from 'vue-router';

  const router = useRouter();

  const props = defineProps({
    item: {
      type: Object,
      required: true,
    },
  });

  const planStore = usePlanerStore();
  const emit = defineEmits(['open-modal', 'delete-task']);

  const handleOpenModal = () => {
    console.log('open modal');
    emit('open-modal', props.item);
  };

  const handleMenuClick = async ({ key }: { key: string }) => {
    switch (key) {
      case 'delete':
        // 处理删除任务（软删除，含子孙任务）
        try {
          await getRepository().deleteTask(props.item.id);
          emit('delete-task', props.item.id);
          switch (planStore.cycleValue) {
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
        } catch (error) {
          console.log('删除任务失败:', error);
        }
        break;
      case 'focus':
        // 处理开始专注
        break;
      case 'flag':
        // 处理添加标记
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

  // 标记当前视图数据已变更，触发 store 刷新
  const markDataChanged = () => {
    switch (planStore.cycleValue) {
      case 1:
        planStore.isQuarterDataChanged = true;
        break;
      case 2:
        planStore.isMonthDataChanged = true;
        break;
      case 3:
        planStore.isWeekDataChanged = true;
        break;
    }
  };

  // 循环规则确认后直接更新任务
  const onLoopRuleChange = async (rule: string | null) => {
    loopRule.value = rule;
    try {
      await getRepository().updateTask(props.item.id, {
        is_cyclic: rule ? 1 : 0,
        cycle_rule: rule,
      });
      markDataChanged();
    } catch (error) {
      console.log('更新循环规则失败:', error);
    }
  };
</script>

<template>
  <template v-if="planStore.cycleValue === 4">
    <a-list-item>
      <template #actions>
        <div class="task-actions">
          <div class="actions-container">
            <RangeButton :range="props.item.sort_order" :disable="true" />
            <PomodoroCounter
              :total-pomodoro="props.item.total_pomodoro_quota"
              :finishedPomodoro="props.item.finished_pomodoro"
              readonly
            />
          </div>
        </div>
      </template>
      <a-list-item-meta>
        <template #title>
          <a-dropdown
            v-model:open="dropdownVisible"
            :trigger="['contextmenu']"
            :trigger-on-click="false"
            placement="bottomLeft"
          >
            <div @click="handleOpenModal" class="task-title">
              <span class="title-text">{{ props.item.title }}</span>
            </div>
            <template #overlay>
              <a-menu @click="handleMenuClick">
                <a-menu-item key="delete">
                  <span class="icon">🗑️</span>
                  删除任务
                </a-menu-item>
                <a-menu-item key="focus">
                  <span class="icon">⏱️</span>
                  开始专注
                </a-menu-item>
                <a-menu-item key="flag">
                  <span class="icon">🚩</span>
                  添加标记
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
        <template #avatar>
          <a-avatar
            @click="
              router.push(
                `/pomodoro/${props.item.id}/${encodeURIComponent(props.item.title)}/${props.item.total_pomodoro_quota}`
              )
            "
          >
            <PlayCircleTwoTone twoToneColor="#52c41a" style="font-size: 20px" />
          </a-avatar>
        </template>
      </a-list-item-meta>
    </a-list-item>
  </template>
  <template v-else>
    <!-- 类似地修改另一个模板部分 -->
    <a-list-item>
      <a-list-item-meta>
        <template #title>
          <a-dropdown
            v-model:open="dropdownVisible"
            :trigger="['contextmenu']"
            placement="bottomCenter"
          >
            <div @click="handleOpenModal" class="task-content">
              <span style="margin-right: auto">{{ props.item.title }}</span>
              <span v-if="props.item.is_cyclic === 1" class="loop-icon" @click.stop="openLoopRule">
                <SyncOutlined />
              </span>
              <RangeButton :range="props.item.sort_order" :disable="true" />
            </div>
            <template #overlay>
              <a-menu @click="handleMenuClick">
                <a-menu-item key="delete">
                  <span class="icon">🗑️</span>
                  删除任务
                </a-menu-item>
                <a-menu-item key="focus">
                  <span class="icon">⏱️</span>
                  开始专注
                </a-menu-item>
                <a-menu-item key="flag">
                  <span class="icon">🚩</span>
                  添加标记
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
      </a-list-item-meta>
    </a-list-item>
  </template>

  <LoopRuleModal
    v-model:open="loopOpen"
    :rule="loopRule"
    :period-type="planStore.cycleValue"
    :start-date="props.item.start_date"
    @update:rule="onLoopRuleChange"
  />
</template>

<style scoped>
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
