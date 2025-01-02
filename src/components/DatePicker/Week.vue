
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
            <a-menu-item key="1">1月</a-menu-item>
            <a-menu-item key="2">2月</a-menu-item>
            <a-menu-item key="3">3月</a-menu-item>
            <a-menu-item key="4">4月</a-menu-item>
            <a-menu-item key="5">5月</a-menu-item>
            <a-menu-item key="6">6月</a-menu-item>
            <a-menu-item key="7">7月</a-menu-item>
            <a-menu-item key="8">8月</a-menu-item>
            <a-menu-item key="9">9月</a-menu-item>
            <a-menu-item key="10">10月</a-menu-item>
            <a-menu-item key="11">11月</a-menu-item>
            <a-menu-item key="12">12月</a-menu-item>
        </a-menu>
      </template>
      <a-button>
        Month
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
  