/**
 * Fonts are bundled, not fetched from Google's CDN.
 *
 * A German court has held that embedding Google Fonts transfers the visitor's
 * IP address to the US without consent and breaches the GDPR — not a footnote
 * for a Berlin sensor network run out of the EU. Self-hosting also removes two
 * cross-origin connections from the critical path and makes the app render
 * identically with no network at all. Only the weights and the latin subset
 * this interface actually uses are imported: five for the sans, two for the
 * mono, 112 kB of woff2 in total rather than the families' full ~1 MB.
 */
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

// Token definitions next: `base.css` declares the cascade-layer order that
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
