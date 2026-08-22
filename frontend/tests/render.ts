import { VueQueryPlugin } from '@tanstack/vue-query';
import { render, type RenderOptions } from '@testing-library/vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import type { Component } from 'vue';
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
  { path: '/sensors', name: 'sensors', component: { template: '<div />' } },
];

/**
 * Mounts a component with the real plugins the app uses.
 *
 * Stubbing the query client or the router would test a different application
 * than the one that ships; the only concession is a fresh QueryClient per test
 * (via a fresh plugin install) so cached data never leaks between cases.
 */
export function renderWithApp(component: Component, options: RenderOptions<never> = {}) {
  const router = createRouter({ history: createWebHistory(), routes });

  const result = render(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [
        createPinia(),
        router,
        [PrimeVue, { theme: 'none', ripple: false }],
        [
          VueQueryPlugin,
          {
            queryClientConfig: {
              defaultOptions: {
                queries: { retry: false, staleTime: Number.POSITIVE_INFINITY, gcTime: 0 },
              },
            },
          },
        ],
        ...(options.global?.plugins ?? []),
      ],
    },
  });

  return { ...result, router };
}
