import '@testing-library/jest-dom/vitest';

import { config } from '@vue/test-utils';
import { beforeAll, vi } from 'vitest';
import { defineComponent, h } from 'vue';

/**
 * ECharts renders to a canvas, and jsdom has no 2D context to give it — the
 * real component throws on mount. Stubbing it keeps the integration tests
 * focused on what they can actually assert (that the right station and range
 * reach the chart); the series the chart is handed are unit-tested against
 * fixtures in `src/domain/downsample.spec.ts`.
 */
vi.mock('vue-echarts', () => ({
  default: defineComponent({
    name: 'VChartStub',
    props: { option: { type: Object, default: () => ({}) } },
    setup: (props) => () =>
      h('div', {
        'data-testid': 'chart-stub',
        'data-series': String(props.option?.['series']?.length ?? 0),
      }),
  }),
}));

/**
 * Depending on the Node version, the `localStorage` global under test is either
 * jsdom's or Node's own experimental Web Storage — and on Node 25 it arrives as
 * a bare object with no methods at all, so anything touching persistence hits a
 * TypeError. The app itself survives that (every storage call is wrapped), but
 * the persistence tests need real behaviour. Installed only when what is
 * already there does not work.
 */
function installMemoryStorage(): void {
  if (typeof window.localStorage?.setItem === 'function') return;

  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  };

  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}

beforeAll(() => {
  installMemoryStorage();

  // jsdom ships no matchMedia; the theme store and responsive helpers rely on
  // it. Default to "light" so tests describe the light theme unless they
  // override this.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // Leaflet and ECharts both measure their container on mount.
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  }
});

config.global.stubs = {
  RouterLink: { template: '<a><slot /></a>' },
};
