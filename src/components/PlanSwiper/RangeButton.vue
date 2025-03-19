<script setup>
  import { ref, watch } from 'vue';

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

  const emit = defineEmits(['update:range']);

  const priorities = [
    {
      label: '重要且紧急',
      value: 1,
      class: 'priority-urgent-important',
      symbol: 'Ⅰ',
      buttonColor: 'rgba(255, 230, 230, 0.5)',
    },
    {
      label: '重要不紧急',
      value: 2,
      class: 'priority-important',
      symbol: 'Ⅱ',
      buttonColor: 'rgba(255, 235, 204, 0.5)',
    },
    {
      label: '不重要紧急',
      value: 3,
      class: 'priority-urgent',
      symbol: 'Ⅲ',
      buttonColor: 'rgba(230, 255, 230, 0.5)',
    },
    {
      label: '不重要不紧急',
      value: 4,
      class: 'priority-normal',
      symbol: 'Ⅳ',
      buttonColor: 'rgba(230, 242, 255, 0.5)',
    },
  ];
  const isDropdownOpen = ref(false);
  const selectedPriority = ref();

  watch(
    () => props.range,
    value => {
      selectedPriority.value = priorities.find(p => p.value === value) || priorities[0];
    },
    { immediate: true }
  );

  const showDropdown = () => {
    if (!props.disable) {
      isDropdownOpen.value = true;
    }
  };

  const hideDropdown = () => {
    isDropdownOpen.value = false;
  };

  const selectPriority = option => {
    emit('update:range', option.value);
    isDropdownOpen.value = false;
  };
</script>

<template>
  <div class="priority-dropdown" @mouseleave="hideDropdown">
    <button
      @mouseenter="showDropdown"
      class="dropdown-button"
      :style="{
        backgroundColor: selectedPriority.buttonColor,
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
