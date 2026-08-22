// Token definitions first: `base.css` declares the cascade-layer order that
// PrimeVue's runtime-injected styles slot into.
import '@/theme/tokens.css';
import '@/assets/styles/base.css';
import 'primeicons/primeicons.css';

import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';

import App from '@/App.vue';
import { vueQueryOptions } from '@/queries/client';
import { router } from '@/router';
import { themeOptions } from '@/theme/preset';

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, { theme: themeOptions, ripple: false })
  .use(VueQueryPlugin, vueQueryOptions)
  .mount('#app');
