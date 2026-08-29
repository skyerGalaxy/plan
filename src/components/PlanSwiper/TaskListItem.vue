<script lang="ts" setup>
  import { usePlanerStore } from '@/stores/planStore';
  import { PlayCircleTwoTone, ClockCircleOutlined, FlagOutlined } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';
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
              <span>{{ props.item.title }}</span>
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
</template>

<style scoped>
  .task-actions {
    margin-left: 50px;
  }

  .actions-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .task-title {
    cursor: pointer;
  }

  .task-content {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
