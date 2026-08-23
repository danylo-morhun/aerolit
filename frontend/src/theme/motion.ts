import { ref } from 'vue';

/**
 * Whether the viewer has asked their system for reduced motion.
 *
 * `tokens.css` already zeroes `--aq-transition` under the media query, which
 * covers everything that animates through CSS. Two things in this app do not:
 * ECharts animates on a canvas and Leaflet animates its own pane transforms.
 * Neither reads the stylesheet, so both have to ask — and a dashboard whose
 * chart still slides while the rest of the interface has stopped is exactly
 * the half-done version of honouring the setting.
 *
 * Reactive rather than read once, so changing the OS setting reaches a page
 * that is already open. One listener for the lifetime of the app.
 */
const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export const reducedMotion = ref(query?.matches === true);

query?.addEventListener('change', (event) => {
  reducedMotion.value = event.matches;
});
