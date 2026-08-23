import { ref } from 'vue';

/**
 * The width below which the layout stops being a narrow tablet and becomes a
 * phone — where the sensor table gives up columns and becomes cards.
 *
 * Declared here *and* in the stylesheets that lay those cards out. CSS cannot
 * read a TypeScript constant and a media query cannot be interpolated into a
 * scoped block, so the two have to be kept in step by hand, the same way the
 * theme storage key is shared with the pre-paint script in `index.html`.
 */
export const PHONE_MAX_WIDTH = 640;

const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`)
    : null;

/**
 * Whether the viewport is phone-width, reactively.
 *
 * Used where a layout change is more than styling: PrimeVue's `scrollable`
 * table builds a sticky header and a scroll container, and at phone width
 * there are no columns to keep in view — the machinery only gets in the way of
 * the card layout that replaces it. That is a prop, not a stylesheet, so it
 * needs the breakpoint as a value.
 */
export const isPhone = ref(query?.matches === true);

query?.addEventListener('change', (event) => {
  isPhone.value = event.matches;
});
