<script lang="ts" setup>
  import { usePlanerStore } from '@/stores/planStore';
  import { PlayCircleTwoTone, ClockCircleOutlined, FlagOutlined } from '@ant-design/icons-vue';
  import RangeButton from './RangeButton.vue';
  import PomodoroCounter from './PomodoroCounter.vue';
  import { ref } from 'vue';
  import { deleteTask } from '@/utils/supabaseFunction';
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
        // 处理删除任务
        await deleteTask(props.item.id, planStore.cycleValue).then(() => {
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
        });
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
        <div style="margin-left: 50px">
          <div style="display: flex; align-items: center; gap: 8px">
            <RangeButton :range="props.item.range" :disable="true" />
            <PomodoroCounter
              :total-pomodoro="props.item.pomodoro_count"
              :finished-pomodoo="props.item.finish_pomodoro"
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
            <div @click="handleOpenModal" style="cursor: pointer">
              <span>{{ props.item.task }}</span>
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
                `/pomodoro/${props.item.id}/${props.item.task}/${props.item.pomodoro_count}`
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
            <div
              @click="handleOpenModal"
              style="cursor: pointer; display: flex; align-items: center; gap: 8px"
            >
              <span style="margin-right: auto">{{ props.item.task }}</span>
              <RangeButton :range="props.item.range" :disable="true" />
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
