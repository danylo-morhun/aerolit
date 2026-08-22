import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'dashboard' } },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/pages/DashboardPage.vue'),
    meta: { title: 'Berlin · Particulate Monitoring', nav: 'Dashboard' },
  },
  {
    path: '/sensors',
    name: 'sensors',
    component: () => import('@/pages/SensorListPage.vue'),
    meta: { title: 'Sensor List', nav: 'Sensor List' },
  },
  { path: '/:pathMatch(.*)*', redirect: { name: 'dashboard' } },
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null;
  document.title = title ? `${title} · Aerolit` : 'Aerolit';
});
