<script setup>
  import { ref } from 'vue';
  import { usePlanerStore } from '@/stores/planStore';

  const props = defineProps({
    range: {
      type: Number,
      default: 1,
    },
    disable: {
      type: Boolean,
      default: false,
    },
  });

  const planStore = usePlanerStore();
  const priorities = [
    { label: '重要且紧急', value: 1, class: 'priority-urgent-important', symbol: 'Ⅰ' },
    { label: '重要不紧急', value: 2, class: 'priority-important', symbol: 'Ⅱ' },
    { label: '不重要紧急', value: 3, class: 'priority-urgent', symbol: 'Ⅲ' },
    { label: '不重要不紧急', value: 4, class: 'priority-normal', symbol: 'Ⅳ' },
  ];
  const isDropdownOpen = ref(false);
  const selectedPriority = ref(priorities.find(p => p.value === props.range) || priorities[0]);
  const selectedValue = ref(props.range);

  const buttonColor = ref('rgba(255, 230, 230, 0.5)');

  planStore.$subscribe((_, state) => {
    if (!props.disable) {
      selectedPriority.value = state.taskRangeInfo;
      selectedValue.value = state.taskRangeIndex;
    }
  });

  const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value;
  };

  const selectPriority = option => {
    planStore.taskRangeInfo = option;
    planStore.taskRangeIndex = option.value;
    selectedValue.value = option.value;
    isDropdownOpen.value = false;
    switch (option.value) {
      case 1:
        buttonColor.value = 'rgba(255, 230, 230, 0.5)';
        break;
      case 2:
        buttonColor.value = 'rgba(255, 235, 204, 0.5)';
        break;
      case 3:
        buttonColor.value = 'rgba(230, 255, 230, 0.5)';
        break;
      case 4:
        buttonColor.value = 'rgba(230, 242, 255, 0.5)';
        break;
      default:
        break;
    }
  };
</script>

<template>
  <div class="priority-dropdown">
    <button
      @click="toggleDropdown"
      class="dropdown-button"
      :style="{
        backgroundColor: buttonColor,
        cursor: disable ? 'grab' : 'pointer',
        opacity: disable ? '0.6' : '1',
      }"
      :disabled="disable"
    >
      <span :class="selectedPriority.class">{{ selectedPriority.symbol }}</span>
    </button>
    <ul v-if="isDropdownOpen" class="dropdown-menu">
      <li
        v-for="option in priorities"
        :key="option.value"
        :class="option.class"
        @click="selectPriority(option)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
  .priority-dropdown {
    position: relative;
    display: inline-block;
  }

  .dropdown-button {
    border: 1px solid #ddd;
    padding: 5px 10px;
    cursor: pointer;
    font-size: 14px;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    background-color: #fff;
    border: 1px solid #ddd;
    box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 150px;
  }

  .dropdown-menu li {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
  }

  .dropdown-menu li:hover {
    background-color: #f0f0f0;
  }

  .priority-urgent-important {
    color: red;
  }

  .priority-important {
    color: orange;
  }

  .priority-urgent {
    color: green;
  }

  .priority-normal {
    color: blue;
  }
</style>
