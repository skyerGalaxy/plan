<script lang="ts" setup>
  import { ref, watch } from 'vue';
  import { notification } from 'ant-design-vue';
  import { DownOutlined, SyncOutlined } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';
  import LoopRuleModal from './LoopRuleModal.vue';
  import { usePlanerStore } from '@/stores/planStore';
  import { getRepository, getPeriodRange, countRuleOccurrences, type NewTask } from '@/api';

  const props = defineProps<{
    operateType: string; //inser on update,decide modalOk function
    task: any;
    visible: boolean;
    slideDate: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void;
    (e: 'task-added', task: any): void;
    (e: 'task-updated', task: any): void;
  }>();

  const repo = getRepository();
  const planStore = usePlanerStore();

  const taskId = ref<string>(props.task.id);
  const taskValue = ref<string>(props.task.title || '');
  const isLoop = ref<boolean>(!!props.task.is_cyclic);
  const cycleRule = ref<string | null>(props.task.cycle_rule || null);
  const loopRuleModalVisible = ref<boolean>(false);
  const pomodoroCount = ref<number>(props.task.total_pomodoro_quota || 0);
  const finishedPomodoo = ref<number>(props.task.finished_pomodoro || 0);
  const rangeValue = ref<number>(props.task.sort_order || 1);
  const parentTaskText = ref<string>('选择父任务');
  const parentTaskIndex = ref<string | null>(null);
  const quarterId = ref<string | null>(null);
  const monthId = ref<string | null>(null);
  const weekId = ref<string | null>(null);
  const confirmLoading = ref<boolean>(false);

  /**
   * 由所选父任务（上一级粒度）解析当前任务的三个上级 id：
   * - 月(2)：quarter_id = 季任务 id
   * - 周(3)：month_id = 月任务 id，quarter_id = 父月的 quarter_id
   * - 日(4)：week_id = 周任务 id，month_id/quarter_id 沿用父周
   */
  function resolveIds(periodType: number, task: any) {
    if (periodType === 2) return { quarter_id: task?.id ?? null, month_id: null, week_id: null };
    if (periodType === 3)
      return { quarter_id: task?.quarter_id ?? null, month_id: task?.id ?? null, week_id: null };
    if (periodType === 4)
      return {
        quarter_id: task?.quarter_id ?? null,
        month_id: task?.month_id ?? null,
        week_id: task?.id ?? null,
      };
    return { quarter_id: null, month_id: null, week_id: null };
  }

  /** 由任务自身的三个上级 id 反推其直接父任务 id（用于编辑回显） */
  function parentIdOfTask(task: any): string | null {
    switch (planStore.cycleValue) {
      case 2:
        return task.quarter_id ?? null;
      case 3:
        return task.month_id ?? null;
      case 4:
        return task.week_id ?? null;
      default:
        return null;
    }
  }

  function resetParentFields() {
    parentTaskIndex.value = null;
    parentTaskText.value = '选择父任务';
    quarterId.value = null;
    monthId.value = null;
    weekId.value = null;
  }

  watch(
    () => props.task,
    newTask => {
      if (props.operateType === 'insert') {
        // Reset fields for new task
        taskId.value = '';
        taskValue.value = '';
        isLoop.value = false;
        cycleRule.value = null;
        pomodoroCount.value = 0;
        finishedPomodoo.value = 0;
        rangeValue.value = 1;
        resetParentFields();
      } else if (newTask && Object.keys(newTask).length > 0) {
        // Load task data for editing
        taskId.value = newTask.id;
        taskValue.value = newTask.title || '';
        isLoop.value = !!newTask.is_cyclic;
        cycleRule.value = newTask.cycle_rule || null;
        pomodoroCount.value = newTask.total_pomodoro_quota || 0;
        finishedPomodoo.value = newTask.finished_pomodoro || 0;
        rangeValue.value = newTask.sort_order || 1;
        quarterId.value = newTask.quarter_id ?? null;
        monthId.value = newTask.month_id ?? null;
        weekId.value = newTask.week_id ?? null;
        parentTaskIndex.value = parentIdOfTask(newTask);
        const parentTask = planStore.parentData.find(
          (item: any) => item.id === parentTaskIndex.value
        );
        parentTaskText.value = parentTask ? parentTask.title : '选择父任务';
        // 编辑循环任务时，番茄计数器显示「单次循环」值 = 总配额 / 周期内循环次数
        if (newTask.is_cyclic && planStore.cycleValue !== 4 && newTask.cycle_rule) {
          const occ = countRuleOccurrences(
            newTask.cycle_rule,
            newTask.start_date,
            newTask.end_date
          );
          pomodoroCount.value = occ > 0 ? Math.round((newTask.total_pomodoro_quota || 0) / occ) : 0;
        }
      }
    },
    {
      immediate: true,
      deep: true,
    }
  );

  function handleMenuClick(task: any) {
    parentTaskText.value = task.title;
    parentTaskIndex.value = task.id;
    // 选中父任务后解析三个上级 id
    const ids = resolveIds(planStore.cycleValue, task);
    quarterId.value = ids.quarter_id;
    monthId.value = ids.month_id;
    weekId.value = ids.week_id;
  }

  // 循环规则确认后，同步 isLoop 状态
  function onRuleChange(rule: string | null) {
    cycleRule.value = rule;
    isLoop.value = !!rule;
  }

  /**
   * 计算本次要写入数据库的总番茄配额：
   * - 日任务：单次番茄数即总配额
   * - 循环任务：单次番茄数 × 周期内循环规则触发的次数
   * - 其他非循环任务：0
   */
  function computeTotalQuota(start: string, end: string): number {
    if (planStore.cycleValue === 4) return pomodoroCount.value;
    if (isLoop.value) {
      return pomodoroCount.value * countRuleOccurrences(cycleRule.value, start, end);
    }
    return 0;
  }

  function modalCancel() {
    emit('update:visible', false);
    taskId.value = '';
    taskValue.value = '';
    isLoop.value = false;
    cycleRule.value = null;
    pomodoroCount.value = 0;
    finishedPomodoo.value = 0;
    rangeValue.value = 1;
    resetParentFields();
    confirmLoading.value = false;
  }

  /** 弹出操作结果提示，消息文案与插入/更新操作及结果保持一致 */
  const openNotificationWithIcon = (type: 'success' | 'error', action?: 'insert' | 'update') => {
    const op = action ?? props.operateType;
    let message: string;
    let description: string;
    if (type === 'success') {
      message = op === 'update' ? '更新成功' : '添加成功';
      description = op === 'update' ? '任务已更新' : '任务已经添加到计划中';
    } else {
      message = op === 'update' ? '更新失败' : '添加失败';
      description = '请检查网络连接或者联系管理员';
    }
    return notification[type]({ message, description });
  };

  async function modalOk() {
    confirmLoading.value = true;

    // 标题必填
    if (!taskValue.value.trim()) {
      notification.warning({ message: '任务填写不完整', description: '请输入任务内容' });
      confirmLoading.value = false;
      return;
    }

    // 日任务必须设置番茄配额
    if (planStore.cycleValue === 4 && pomodoroCount.value <= 0) {
      notification.warning({ message: '请设置番茄数' });
      confirmLoading.value = false;
      return;
    }

    // 月/周/日任务的非循环场景必须指定父任务；循环的月/周任务可无父任务创建；季任务无父任务要求
    const parentUnselected = parentTaskIndex.value === null;
    const parentRequired =
      [2, 3, 4].includes(planStore.cycleValue) && !(isLoop.value && planStore.cycleValue !== 4);
    if (parentRequired && parentUnselected) {
      notification.warning({
        message: '请选择父任务',
        description: '未指定父任务，任务无法创建',
      });
      confirmLoading.value = false;
      return;
    }

    // 当前视图上下文对应的起止日期
    const periodRange = getPeriodRange(planStore.cycleValue, {
      year: planStore.year,
      quarter: planStore.quarter,
      month: planStore.month,
      weekViewIndex: planStore.weekViewIndex,
      slideDate: props.slideDate,
    });

    try {
      if (props.operateType === 'insert') {
        const addedTask = await repo.createTask({
          quarter_id: quarterId.value,
          month_id: monthId.value,
          week_id: weekId.value,
          title: taskValue.value.trim(),
          description: '',
          period_type: planStore.cycleValue as 1 | 2 | 3 | 4,
          total_pomodoro_quota: computeTotalQuota(periodRange.start, periodRange.end),
          start_date: periodRange.start,
          end_date: periodRange.end,
          is_cyclic: isLoop.value ? 1 : 0,
          cycle_rule: isLoop.value ? cycleRule.value : null,
          sort_order: rangeValue.value,
          status: 'pending',
        });
        emit('task-added', addedTask);
        openNotificationWithIcon('success');
      } else if (props.operateType === 'update') {
        const patch: Partial<NewTask> = {
          title: taskValue.value.trim(),
          quarter_id: quarterId.value,
          month_id: monthId.value,
          week_id: weekId.value,
          sort_order: rangeValue.value,
          total_pomodoro_quota: computeTotalQuota(periodRange.start, periodRange.end),
          is_cyclic: isLoop.value ? 1 : 0,
          cycle_rule: isLoop.value ? cycleRule.value : null,
        };
        const updatedTask = await repo.updateTask(taskId.value, patch);
        emit('task-updated', updatedTask);
        openNotificationWithIcon('success');
      }

      // 标记数据变化，触发对应视图重新加载。
      // 更新时按任务"自身的层级"而非当前视图标记，保证在子视图编辑继承的上级循环任务时也能正确联动。
      const taskLevel = props.operateType === 'insert' ? planStore.cycleValue : props.task.period_type;
      switch (taskLevel) {
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
      console.log('保存任务失败:', error);
      openNotificationWithIcon('error');
    }

    // 重置表单
    confirmLoading.value = false;
    modalCancel();
  }
</script>

<template>
  <a-modal
    :open="visible"
    @update:open="(val: boolean) => emit('update:visible', val)"
    centered
    :confirm-loading="confirmLoading"
    @cancel="modalCancel"
    @ok="modalOk"
  >
    <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 40px">
      <div style="display: flex; gap: 10px; margin-bottom: 10px">
        <a-input v-model:value="taskValue" placeholder="把事情记下来" />
        <RangeButton v-model:range="rangeValue" />
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px">
        <span
          v-if="planStore.cycleValue !== 4"
          @click="loopRuleModalVisible = true"
          :style="{
            display: 'inline-flex',
            alignItems: 'center',
            cursor: 'pointer',
            color: isLoop ? '#1677ff' : 'rgba(0, 0, 0, 0.45)',
            fontSize: '18px',
            userSelect: 'none',
            transition: 'color 0.2s',
          }"
        >
          <SyncOutlined />
        </span>
        <a-dropdown v-if="planStore.cycleValue !== 1 && !isLoop">
          <template #overlay>
            <a-menu
              :selected-keys="[parentTaskText.toString()]"
              :style="{ maxHeight: '250px', overflowY: 'auto' }"
            >
              <a-menu-item
                v-for="(item, index) in planStore.parentData"
                @click="handleMenuClick(item)"
                :key="index"
              >
                <div
                  v-if="item.title.length > 13"
                  style="display: flex; justify-content: space-between; width: 100%"
                >
                  <a-tooltip v-if="item.title.length > 13" :title="item.title">
                    <span>
                      {{ item.title.substring(0, 13) + '...' }}
                    </span>
                  </a-tooltip>
                  <RangeButton :range="item.sort_order" :disable="true" />
                </div>
                <div v-else style="display: flex; justify-content: space-between; width: 100%">
                  <span>{{ item.title }}</span>
                  <RangeButton :range="item.sort_order" :disable="true" />
                </div>
              </a-menu-item>
            </a-menu>
          </template>
          <a-button class="parent-task-button">
            <span class="parent-task-value">{{ parentTaskText }}</span>
            <DownOutlined :style="{ 'padding-top': '5px' }" />
          </a-button>
        </a-dropdown>
        <div class="rate-container" v-if="isLoop || planStore.cycleValue == 4">
          <PomodoroCounter
            v-model:totalPomodoro="pomodoroCount"
            :finishedPomodoro="finishedPomodoo"
            :readonly="false"
          />
        </div>
      </div>
    </div>
    <LoopRuleModal
      v-model:open="loopRuleModalVisible"
      :rule="cycleRule"
      :period-type="planStore.cycleValue"
      :start-date="props.slideDate"
      @update:rule="onRuleChange"
    />
  </a-modal>
</template>

<style scoped>
  .parent-task-button {
    width: 150px;
    display: flex;
    justify-content: space-between;
  }

  .parent-task-value {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rate-container {
    display: flex;
    gap: 8px;
  }
</style>
