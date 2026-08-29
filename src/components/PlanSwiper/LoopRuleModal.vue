<script lang="ts" setup>
  import { computed, ref, watch } from 'vue';
  import dayjs from 'dayjs';
  import { notification } from 'ant-design-vue';

  // 循环规则 type 命名规范（全部唯一）：
  // cycle_daily        周期内每日循环      {"type":"cycle_daily"}
  // cycle_workday      工作日(周一-周五)   {"type":"cycle_workday"}
  // cycle_weekend      休息日(周六-周日)   {"type":"cycle_weekend"}
  // cycle_weekly_days  指定星期集合 1~7    {"type":"cycle_weekly_days","days":[1,3,5]}
  // cycle_monthly_days 指定月内日期集合    {"type":"cycle_monthly_days","days":[1,15]}
  type RecurType =
    | 'cycle_daily'
    | 'cycle_workday'
    | 'cycle_weekend'
    | 'cycle_weekly_days'
    | 'cycle_monthly_days';

  type SelectionType = 'none' | RecurType;

  const props = defineProps<{
    open: boolean;
    rule: string | null;
    periodType: number; // 1 季 2 月 3 周 4 日（对应 tasks.period_type）
    startDate: string;
  }>();

  const emit = defineEmits<{
    (e: 'update:open', value: boolean): void;
    (e: 'update:rule', value: string | null): void;
  }>();

  // 各循环类型允许出现的任务粒度（1:季 2:月 3:周 4:日；日度禁止任何循环）
  const OPTIONS: {
    type: RecurType;
    title: string;
    icon: string;
    period: number[];
  }[] = [
    { type: 'cycle_daily', title: '每日循环', icon: '📅', period: [1, 2, 3] },
    { type: 'cycle_workday', title: '工作日', icon: '💼', period: [1, 2, 3] },
    { type: 'cycle_weekend', title: '休息日', icon: '🏖️', period: [1, 2, 3] },
    { type: 'cycle_weekly_days', title: '指定星期', icon: '📆', period: [1, 2, 3] },
    { type: 'cycle_monthly_days', title: '指定日期', icon: '🗓️', period: [1] },
  ];

  // 粒度对应的周期称谓（用于描述文案）
  const PERIOD_TEXT: Record<number, string> = { 1: '季度', 2: '月', 3: '周' };

  const weekDays = [
    { label: '一', value: 1 },
    { label: '二', value: 2 },
    { label: '三', value: 3 },
    { label: '四', value: 4 },
    { label: '五', value: 5 },
    { label: '六', value: 6 },
    { label: '日', value: 7 },
  ];

  const allowedTypes = computed<RecurType[]>(() => {
    return OPTIONS.filter(o => o.period.includes(props.periodType)).map(o => o.type);
  });

  // 不循环始终可选；可选项依赖 allowedTypes，需在 immediate watch 之前定义
  const selectableTypes = computed<SelectionType[]>(() => ['none', ...allowedTypes.value]);

  const isDayGranularity = computed(() => props.periodType === 4);

  const selectedType = ref<SelectionType>('none');
  const weeklyDays = ref<number[]>([1]);
  const monthlyDays = ref<number[]>([1]);

  // 类型卡片的一行描述
  function describeType(o: (typeof OPTIONS)[number]): string {
    const periodText = PERIOD_TEXT[props.periodType] || '周期';
    switch (o.type) {
      case 'cycle_daily':
        return `${periodText}期内每天生效`;
      case 'cycle_workday':
        return '周一至周五生效，周末跳过';
      case 'cycle_weekend':
        return '周六至周日生效，工作日跳过';
      case 'cycle_weekly_days':
        return '指定星期几生效，可多选';
      case 'cycle_monthly_days':
        return `${periodText}内每月固定几号生效，可多选`;
      default:
        return '';
    }
  }

  // 根据规则回显表单（保留历史状态，供取消时恢复）
  function applyRule(rule: string | null) {
    if (!rule) {
      selectedType.value = 'none';
      weeklyDays.value = [1];
      monthlyDays.value = [1];
      return;
    }
    try {
      const parsed = JSON.parse(rule);
      const t = parsed?.type as SelectionType;
      if (t && selectableTypes.value.includes(t)) {
        selectedType.value = t;
      } else {
        selectedType.value = 'none';
      }
      if (t === 'cycle_weekly_days' && Array.isArray(parsed.days)) {
        weeklyDays.value = parsed.days.filter((d: number) => d >= 1 && d <= 7);
      } else {
        weeklyDays.value = [1];
      }
      if (t === 'cycle_monthly_days' && Array.isArray(parsed.days)) {
        monthlyDays.value = parsed.days.filter((d: number) => d >= 1 && d <= 31);
      } else {
        monthlyDays.value = [1];
      }
    } catch {
      selectedType.value = 'none';
      weeklyDays.value = [1];
      monthlyDays.value = [1];
    }
  }

  watch(
    () => props.rule,
    rule => applyRule(rule),
    { immediate: true }
  );

  // 每次打开弹窗时，重置为该任务已保存的循环规则
  watch(
    () => props.open,
    open => {
      if (open) applyRule(props.rule);
    }
  );

  // 粒度切换后，原选中类型不再允许时重置为不循环
  watch(
    () => props.periodType,
    () => {
      if (selectedType.value !== 'none' && !allowedTypes.value.includes(selectedType.value)) {
        selectedType.value = 'none';
      }
    }
  );

  function toggleIn(list: number[], value: number) {
    const i = list.indexOf(value);
    if (i >= 0) {
      list.splice(i, 1);
    } else {
      list.push(value);
    }
  }

  function buildRule(): string | null {
    switch (selectedType.value) {
      case 'cycle_daily':
        return JSON.stringify({ type: 'cycle_daily' });
      case 'cycle_workday':
        return JSON.stringify({ type: 'cycle_workday' });
      case 'cycle_weekend':
        return JSON.stringify({ type: 'cycle_weekend' });
      case 'cycle_weekly_days':
        return JSON.stringify({
          type: 'cycle_weekly_days',
          days: [...weeklyDays.value].sort((a, b) => a - b),
        });
      case 'cycle_monthly_days':
        return JSON.stringify({
          type: 'cycle_monthly_days',
          days: [...monthlyDays.value].sort((a, b) => a - b),
        });
      case 'none':
      default:
        return null;
    }
  }

  // ---- 预览句 ----
  const preview = computed(() => {
    const t = selectedType.value;
    const periodText = PERIOD_TEXT[props.periodType] || '周期';
    const mk = (list: number[]) =>
      list
        .slice()
        .sort((a, b) => a - b)
        .map(x => weekDays.find(w => w.value === x)?.label)
        .join('、');
    let text = '';
    let nextDates: string[] = [];
    switch (t) {
      case 'cycle_daily':
        text = `${periodText}期内每日循环`;
        nextDates = nextDaily(props.startDate, 3);
        break;
      case 'cycle_workday':
        text = '每个工作日（周一至周五）循环';
        nextDates = nextWorkday(props.startDate, 3);
        break;
      case 'cycle_weekend':
        text = '每个休息日（周六、周日）循环';
        nextDates = nextWeekend(props.startDate, 3);
        break;
      case 'cycle_weekly_days':
        text = `每周${mk(weeklyDays.value)}循环`;
        nextDates = nextWeeklyDays(props.startDate, weeklyDays.value, 3);
        break;
      case 'cycle_monthly_days':
        text = `每月${monthlyDays.value
          .slice()
          .sort((a, b) => a - b)
          .map(x => `${x}日`)
          .join('、')}循环`;
        nextDates = nextMonthlyDays(props.startDate, monthlyDays.value, 3);
        break;
      case 'none':
      default:
        text = '不循环（仅执行一次）';
        break;
    }
    return { text, nextDates };
  });

  // ---- 下次触发日期计算（从开始日的次日起算） ----
  // 所有推算函数都加了 isValid 校验与最大步数护栏，避免无效日期导致死循环
  const MAX_STEPS = 10000;

  function nextDaily(start: string, count: number): string[] {
    const s = dayjs(start);
    if (!s.isValid()) return [];
    return Array.from({ length: count }, (_, i) => s.add(i + 1, 'day').format('MM/DD'));
  }

  function nextWorkday(start: string, count: number): string[] {
    const res: string[] = [];
    const base = dayjs(start);
    if (!base.isValid()) return [];
    let day = base;
    let guard = 0;
    while (res.length < count && guard++ < MAX_STEPS) {
      day = day.add(1, 'day');
      const w = day.day();
      if (w >= 1 && w <= 5) res.push(day.format('MM/DD'));
    }
    return res;
  }

  function nextWeekend(start: string, count: number): string[] {
    const res: string[] = [];
    const base = dayjs(start);
    if (!base.isValid()) return [];
    let day = base;
    let guard = 0;
    while (res.length < count && guard++ < MAX_STEPS) {
      day = day.add(1, 'day');
      const w = day.day();
      if (w === 0 || w === 6) res.push(day.format('MM/DD'));
    }
    return res;
  }

  function nextWeeklyDays(start: string, days: number[], count: number): string[] {
    if (!days.length) return [];
    const res: string[] = [];
    const base = dayjs(start);
    if (!base.isValid()) return [];
    const set = new Set(days.map(d => d % 7)); // 周一=1..周六=6、周日=0
    let day = base;
    let guard = 0;
    while (res.length < count && guard++ < MAX_STEPS) {
      day = day.add(1, 'day');
      if (set.has(day.day())) res.push(day.format('MM/DD'));
    }
    return res;
  }

  function nextMonthlyDays(start: string, days: number[], count: number): string[] {
    if (!days.length) return [];
    const res: string[] = [];
    const base = dayjs(start);
    if (!base.isValid()) return [];
    let cursor = base.add(1, 'month').date(1);
    let guard = 0;
    while (res.length < count && guard++ < MAX_STEPS) {
      const dim = cursor.daysInMonth();
      for (const d of [...days].sort((a, b) => a - b)) {
        if (d > dim) continue;
        const dt = cursor.date(d);
        if (dt.isAfter(base) && res.length < count) res.push(dt.format('MM/DD'));
      }
      cursor = cursor.add(1, 'month');
    }
    return res;
  }

  function handleOk() {
    if (selectedType.value === 'cycle_weekly_days' && weeklyDays.value.length === 0) {
      notification.warning({ message: '请至少选择一个星期' });
      return;
    }
    if (selectedType.value === 'cycle_monthly_days' && monthlyDays.value.length === 0) {
      notification.warning({ message: '请至少选择一个日期' });
      return;
    }
    // 日度任务禁止循环：selectedType 只能为 none，强制输出 null（is_cyclic=0）
    emit('update:rule', buildRule());
    emit('update:open', false);
  }

  function handleCancel() {
    // 取消时不保存，恢复到已保存的循环规则
    applyRule(props.rule);
    emit('update:open', false);
  }

  const monthDateButtons = Array.from({ length: 31 }, (_, i) => i + 1);
</script>

<template>
  <a-modal
    :open="open"
    :centered="true"
    :width="420"
    title="循环规则"
    ok-text="确定"
    cancel-text="取消"
    @update:open="(val: boolean) => emit('update:open', val)"
    @cancel="handleCancel"
    @ok="handleOk"
  >
    <!-- 日度任务禁止任何循环 -->
    <p v-if="isDayGranularity" class="day-tip">
      日度任务不支持循环规则，保存后 is_cyclic = 0、cycle_rule = null
    </p>

    <!-- 类型选择：卡片式（不循环 + 当前粒度允许的循环类型） -->
    <div class="type-grid">
      <div
        class="type-card"
        :class="{ active: selectedType === 'none' }"
        @click="selectedType = 'none'"
      >
        <span class="type-icon">🚫</span>
        <span class="type-name">不循环</span>
        <span class="type-desc">仅执行一次</span>
      </div>
      <div
        v-for="opt in OPTIONS"
        v-show="allowedTypes.includes(opt.type)"
        :key="opt.type"
        class="type-card"
        :class="{ active: selectedType === opt.type }"
        @click="selectedType = opt.type"
      >
        <span class="type-icon">{{ opt.icon }}</span>
        <span class="type-name">{{ opt.title }}</span>
        <span class="type-desc">{{ describeType(opt) }}</span>
      </div>
    </div>

    <!-- 参数区：随类型切换 -->
    <div class="param-area">
      <!-- 指定星期集合（1~7，替代原 interval 隔天） -->
      <div v-if="selectedType === 'cycle_weekly_days'" class="param-block">
        <p class="param-tip">选择生效星期（周一 = 1 … 周日 = 7，可多选）</p>
        <div class="week-buttons">
          <button
            v-for="w in weekDays"
            :key="w.value"
            type="button"
            class="week-btn"
            :class="{ active: weeklyDays.includes(w.value) }"
            @click="toggleIn(weeklyDays, w.value)"
          >
            {{ w.label }}
          </button>
        </div>
      </div>

      <!-- 指定月内日期集合（仅季度任务可选） -->
      <div v-else-if="selectedType === 'cycle_monthly_days'" class="param-block">
        <p class="param-tip">选择每月生效的日期（可多选）</p>
        <div class="day-grid">
          <button
            v-for="d in monthDateButtons"
            :key="d"
            type="button"
            class="day-btn"
            :class="{ active: monthlyDays.includes(d) }"
            @click="toggleIn(monthlyDays, d)"
          >
            {{ d }}
          </button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
  .day-tip {
    margin: 0 0 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #fffbe6;
    border: 1px solid #ffe58f;
    color: #d48806;
    font-size: 12px;
    line-height: 1.5;
  }

  .type-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    margin: 4px 0 16px;
  }

  .type-card {
    position: relative;
    padding: 12px 14px;
    border: 1px solid #f0f0f0;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .type-card:hover {
    border-color: #1677ff;
  }

  .type-card.active {
    border-color: #1677ff;
    background: rgba(22, 119, 255, 0.06);
    box-shadow: 0 0 0 1px #1677ff;
  }

  .type-icon {
    display: block;
    font-size: 20px;
    margin-bottom: 6px;
  }

  .type-name {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.88);
  }

  .type-desc {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    line-height: 1.4;
  }

  .param-area {
    min-height: 64px;
    margin-bottom: 16px;
  }

  .param-block {
    padding-top: 12px;
    padding-bottom: 12px;
    border-top: 1px solid #f5f5f5;
  }

  .param-tip {
    color: rgba(0, 0, 0, 0.45);
    font-size: 12px;
    margin-bottom: 10px;
  }

  .week-buttons {
    display: flex;
    gap: 8px;
  }

  .week-btn {
    flex: 1;
    height: 36px;
    border: 1px solid #d9d9d9;
    border-radius: 50%;
    background: #fff;
    color: rgba(0, 0, 0, 0.65);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
  }

  .week-btn.active {
    border-color: #1677ff;
    background: #1677ff;
    color: #fff;
  }

  .day-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
  }

  .day-btn {
    height: 30px;
    border: 1px solid #e5e5e5;
    border-radius: 6px;
    background: #fff;
    color: rgba(0, 0, 0, 0.65);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 12px;
  }

  .day-btn.active {
    border-color: #1677ff;
    background: #1677ff;
    color: #fff;
  }

  .preview-area {
    padding: 10px 12px;
    border-radius: 8px;
    background: #fafafa;
    border: 1px dashed #d9d9d9;
  }

  .preview-text {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.75);
  }

  .preview-dates {
    margin-top: 4px;
    font-size: 12px;
    color: #1677ff;
  }
</style>
