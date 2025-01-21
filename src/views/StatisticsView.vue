<script setup lang="ts">
  // import { createClient } from '@supabase/supabase-js'
  // import { ref, onMounted } from 'vue'

  // const myData = ref<any>([]) // 初始化为空数组，确保数据结构一致

  // const supabaseUrl = import.meta.env.VITE_supabaseProjectUrl
  // const supabaseKey = import.meta.env.VITE_anonKey
  // const supabase = createClient(supabaseUrl, supabaseKey)

  // onMounted(async () => {
  //   try {
  //     const { data, error } = await supabase.from('QuarterlyPlans').select('*')
  //     if (error) {
  //       console.error('Error fetching data:', error)
  //     } else {
  //       myData.value = data
  //       console.log('Fetched data:', myData.value)
  //     }
  //   } catch (error) {
  //     console.error('Unexpected error:', error)
  //   }
  // })

  import { usePlanerStore } from '@/stores/planStore';
  const planStore = usePlanerStore();
</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-content style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
        <div v-if="planStore.dayData.length > 0">
          <h1>Fetched Data:</h1>
          <pre>{{ planStore.dayData }}</pre>
          <h2>First Plan:</h2>
          <pre>{{ planStore.dayData[0] }}</pre>
        </div>
        <div v-else>
          <h3>No Data Fetched</h3>
        </div>
    </a-layout-content>
  </a-layout>
</template>