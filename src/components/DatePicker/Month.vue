
<script lang="ts" setup>
import { ref } from 'vue';
import { DownOutlined } from '@ant-design/icons-vue';
import type { MenuProps } from 'ant-design-vue';

const handleMenuClick: MenuProps['onClick'] = e => {
  console.log('click', e);
  selectedKeys.value = [e.key];
};

const selectedKeys = ref<string[]>([]);
</script>

<template>
  <div class="demo-dropdown-wrap">
    <a-dropdown>
      <template #overlay>
        <a-menu @click="handleMenuClick" v-model:selectedKeys="selectedKeys">
          <a-menu-item key="1">
            第一季度
          </a-menu-item>
          <a-menu-item key="2">
            第二季度
          </a-menu-item>
          <a-menu-item key="3">
            第三季度
          </a-menu-item>
          <a-menu-item key="4">
            第四季度
          </a-menu-item>
        </a-menu>
      </template>
      <a-button>
        Quater
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
