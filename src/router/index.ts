import { createRouter, createWebHistory } from 'vue-router';
import PlanView from '@/views/PlanView.vue';
import PersonView from '@/views/PersonView.vue';
import StatisticsView from '@/views/StatisticsView.vue';
import PomodoroTimer from '@/components/PlanSwiper/PomodoroTimer.vue';

const routes = [
  {
    path: '/',
    name: 'Plan',
    component: PlanView,
  },
  {
    path: '/person',
    name: 'Person',
    component: PersonView,
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: StatisticsView,
  },
  {
    path: '/pomodoro',
    name: 'PomodoroTimer',
    component: PomodoroTimer,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
