
<script lang="ts" setup>
import { DownOutlined } from '@ant-design/icons-vue';
import type { MenuProps } from 'ant-design-vue';

const handleMenuClick: MenuProps['onClick'] = e => {
  console.log('click', e);
};
</script>

<template>
    <div class="demo-dropdown-wrap">
      <a-dropdown>
      <template #overlay>
        <a-menu @click="handleMenuClick">
            <a-menu-item key="1">第一周</a-menu-item>
            <a-menu-item key="2">第二周</a-menu-item>
            <a-menu-item key="3">第三周</a-menu-item>
            <a-menu-item key="4">第四周</a-menu-item>
            <a-menu-item key="5">第五周</a-menu-item>
        </a-menu>
      </template>
      <a-button>
        week
        <DownOutlined />
      </a-button>
    </a-dropdown>
    </div>
  </template>

  <style lang="less" scoped>
  .demo-dropdown-wrap :deep(.ant-dropdown-button) {
    margin-right: 8px;
    margin-bottom: 8px;
  }
  </style>
  