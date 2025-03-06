<script lang="ts" setup>
import { ref,onMounted} from 'vue';
import AddPlanButton from '@/components/PlanSwiper/AddPlanButton.vue';
import { usePlanerStore } from '@/stores/planStore';

const planStore = usePlanerStore();

interface Task {
  [key: string]: any;
}

const props = defineProps<{
  slideDate: string;
  taskData: Task[];
}>();


const task = ref(props.taskData)

onMounted(() => {
  console.log("listview",props.taskData,props.slideDate);
});
</script>


<template>
  <div class="header">
    <div class="date">{{ slideDate }}</div>
    <div>
      <AddPlanButton :slideDate="slideDate"/>
    </div>
  </div>
  <hr style="margin: 10px;border-color:azure;"/>
  <div class="list-container">
<div v-for="item in task" class="list-item" :key="item.id">
  <template v-if="planStore.cycleValue === 1">
    {{ item.task }}
  </template>
  <template v-else-if="planStore.cycleValue === 2">
    {{ item.task }}
  </template>
  <template v-else-if="planStore.cycleValue === 3">
    {{ item.task }}
  </template>
  <template v-else-if="planStore.cycleValue === 4">
    {{ item.task }}
  </template>
</div>
  </div>
</template>




<style scoped>
  .header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: 5px;
    margin: 15px;
    font-size: larger;
  }

  .list-container {
    display: flex;
    flex-direction: row;
    width: 100%;
    flex-wrap: wrap;
    max-height: 500px;
    overflow-y: auto;
  }
 .list-item {
    display: flex;
    flex-direction: row;
    margin: 10px;
    padding: 10px;
    width: 300px;
  }

  .circle-checkbox:checked {
        background: #1673ff;
      }

  /* 设置复选框样式 */
  .circle-checkbox {
    width: 25px;
    height: 25px;
    background-color: #ffffff;
    border: solid 1px #dddddd;
    -webkit-border-radius: 50%;
    border-radius: 50%;
    font-size: 0.8rem;
    margin: 0;
    padding: 0;
    position: relative;
    display: inline-block;
    vertical-align: top;
    cursor: default;
    -webkit-appearance: none;
    appearance: none;
    -webkit-user-select: none;
    user-select: none;
  }

  /* 设置伪类，即显现的对勾样式 */
  .circle-checkbox:checked::after {
    content: "";
    top: 7px;
    left: 7px;
    position: absolute;
    background-color: #d4e72a;
    background: transparent;
    border: #fff solid 2px;
    border-top: none;
    border-right: none;
    height: 6px;
    width: 10px;
    -moz-transform: rotate(-45deg);
    -ms-transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
    transform: rotate(-45deg);
  }


  .content-column {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-left: 10px;
  }
  .title {
    font-weight: bold;
  }
  .description {
    color: #888;
  }
  </style>

  