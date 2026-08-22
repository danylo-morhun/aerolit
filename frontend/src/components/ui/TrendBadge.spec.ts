import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';

import TrendBadge from './TrendBadge.vue';

describe('TrendBadge', () => {
  it('shows an improvement arrow for a fall in a lower-is-better KPI', () => {
    // The mockup pairs "−2.4" with ↗: falling PM2.5 is good news. The arrow
    // encodes the interpretation, the signed number the magnitude.
    const { container } = render(TrendBadge, {
      props: { delta: -2.4, higherIsBetter: false },
    });

    expect(container.textContent).toContain('↗');
    expect(container.textContent).toContain('−2.4');
    expect(container.querySelector('.trend--good')).not.toBeNull();
  });

  it('shows a regression arrow for a rise in a lower-is-better KPI', () => {
    const { container } = render(TrendBadge, {
      props: { delta: 16, higherIsBetter: false, fractionDigits: 0 },
    });

    expect(container.textContent).toContain('↙');
    expect(container.textContent).toContain('+16');
    expect(container.querySelector('.trend--bad')).not.toBeNull();
  });

  it('reads a rise as good when higher is better', () => {
    const { container } = render(TrendBadge, {
      props: { delta: 6, higherIsBetter: true, fractionDigits: 0 },
    });

    expect(container.querySelector('.trend--good')).not.toBeNull();
  });

  it('renders flat rather than a coloured badge for noise', () => {
    const { container } = render(TrendBadge, {
      props: { delta: 0.0001, higherIsBetter: true },
    });

    expect(container.querySelector('.trend--flat')).not.toBeNull();
  });

  it('degrades to a dash when there is no comparison', () => {
    render(TrendBadge, { props: { delta: null, higherIsBetter: true } });

    expect(screen.getByText('No week-over-week comparison available')).toBeInTheDocument();
  });

  it('states the movement in words for screen readers', () => {
    render(TrendBadge, {
      props: { delta: -2.4, higherIsBetter: false, unitLabel: 'µg/m³' },
    });

    expect(screen.getByText(/Week over week: −2.4 µg\/m³, better/)).toBeInTheDocument();
  });
});
