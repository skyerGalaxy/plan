import { createRouter, createWebHashHistory } from 'vue-router'
import { PlanView, StatisticsView, PersonView } from '@/views'

const routes = [
  { path: '/', component: PlanView },
  { path: '/statis', component: StatisticsView },
  { path: '/person', component: PersonView }
]

const router = createRouter({
  history: createWebHashHistory(), // 使用 hash 模式
  routes,
})

export default router
