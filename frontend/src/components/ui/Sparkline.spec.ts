import { render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';

import Sparkline from './Sparkline.vue';

describe('Sparkline', () => {
  it('plots one vertex per reading', () => {
    const { container } = render(Sparkline, { props: { values: [10, 20, 15, 30] } });

    const points = container.querySelector('.spark__line')?.getAttribute('points');
    expect(points?.split(' ')).toHaveLength(4);
  });

  it('spans the full height between its own min and max', () => {
    // The scale is per-sparkline: at this size the glyph communicates shape,
    // and a shared network-wide scale would flatten most rows to a line.
    const { container } = render(Sparkline, { props: { values: [10, 20] } });

    const [first, second] = (container.querySelector('.spark__line')?.getAttribute('points') ?? '')
      .split(' ')
      .map((pair) => Number(pair.split(',')[1]));

    expect(first).toBeGreaterThan(second!);
  });

  it('renders a placeholder when there is nothing to plot', () => {
    const { container } = render(Sparkline, { props: { values: [] } });

    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.spark--empty')).not.toBeNull();
  });

  it('takes its colour from the AQI category', () => {
    const { container } = render(Sparkline, {
      props: { values: [1, 2, 3], category: 'elevated' },
    });

    expect(container.querySelector('.spark--elevated')).not.toBeNull();
  });
});
