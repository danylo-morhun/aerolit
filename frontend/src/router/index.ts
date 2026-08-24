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
  /**
   * Top of the page on a real navigation, and nowhere on a control being used.
   *
   * The dashboard writes its selection into the query (`useSelectionUrl`), so
   * picking a marker or switching the chart range is a `replace` — and a blanket
   * `{ top: 0 }` treated each one as arriving somewhere new, throwing the
   * operator back to the KPI row every time they touched the map. Harmless on
   * the sensor list, where a page change genuinely means new rows at the top;
   * wrong on a page whose whole point is that the map, the watchlist and the
   * chart are on screen together.
   *
   * `savedPosition` first, so the back button restores where the operator was.
   */
  scrollBehavior: (to, from, savedPosition) => {
    if (savedPosition) return savedPosition;
    if (to.path === from.path) return false;
    return { top: 0 };
  },
});

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : null;
  document.title = title ? `${title} · Aerolit` : 'Aerolit';
});
