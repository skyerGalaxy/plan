<script setup lang="ts">
  import { createClient } from '@supabase/supabase-js'
  import { ref, onMounted } from 'vue'

  const myData = ref<any>([]) // 初始化为空数组，确保数据结构一致

  const supabaseUrl = import.meta.env.VITE_supabaseProjectUrl
  const supabaseKey = import.meta.env.VITE_anonKey
  const supabase = createClient(supabaseUrl, supabaseKey)

  onMounted(async () => {
    try {
      const { data, error } = await supabase.from('QuarterlyPlans').select('*')
      if (error) {
        console.error('Error fetching data:', error)
      } else {
        myData.value = data
        console.log('Fetched data:', myData.value)
      }
    } catch (error) {
      console.error('Unexpected error:', error)
    }
  })
</script>

<template>
  <a-layout style="height: 90vh; display: flex; flex-direction: column;">
    <a-layout-content style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
        <div v-if="myData.length > 0">
          <h3>Fetched Data:</h3>
          <pre>{{ myData }}</pre>
        </div>
        <div v-else>
          <h3>No Data Fetched</h3>
        </div>
    </a-layout-content>
  </a-layout>
</template>