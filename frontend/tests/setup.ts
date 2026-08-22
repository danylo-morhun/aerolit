import '@testing-library/jest-dom/vitest';

import { config } from '@vue/test-utils';
import { beforeAll, vi } from 'vitest';

beforeAll(() => {
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
