import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';

import StatTile from './StatTile.vue';

const base = {
  label: 'Avg PM2.5',
  value: '12.4',
  icon: 'pi pi-chart-line',
} as const;

describe('StatTile', () => {
  it('renders the figure, its unit and its label', () => {
    const { container } = render(StatTile, {
      props: { ...base, unit: 'µg/m³' },
    });

    expect(container.querySelector('.tile__value')?.textContent).toContain('12.4');
    expect(screen.getByText('µg/m³')).toBeInTheDocument();
    expect(screen.getByText('Avg PM2.5')).toBeInTheDocument();
  });

  it('is an article, which is how the row is read and addressed', () => {
    // The KPI row is four peers rather than a list of values, and both the
    // dashboard test and the e2e suite find a tile by the text inside its
    // article. Losing the element would break the landmark and them with it.
    render(StatTile, { props: base });

    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('tones the icon without tinting the number', () => {
    // Colour marks the metric, not the reading — the figure stays ink so the
    // four tiles read as one row rather than four verdicts.
    const { container } = render(StatTile, { props: { ...base, tone: 'bad' } });

    expect(container.querySelector('.tile__icon--bad')).not.toBeNull();
    expect(container.querySelector('.tile__value')?.className).toBe('tile__value');
  });

  it('hands the delta to the badge in the KPI’s own direction', () => {
    // Avg PM2.5 rising is bad news; the tile passes the direction through
    // rather than deciding it, so the badge colours the meaning, not the sign.
    const { container } = render(StatTile, {
      props: {
        ...base,
        delta: 0.34,
        higherIsBetter: false,
        deltaFractionDigits: 1,
        deltaUnitLabel: 'µg/m³',
      },
    });

    expect(screen.getByText(/Week over week: \+0.3 µg\/m³, worse/)).toBeInTheDocument();
    expect(container.querySelector('.trend--bad')).not.toBeNull();
  });

  it('says there is no comparison rather than implying a flat week', () => {
    render(StatTile, { props: { ...base, delta: null } });

    expect(screen.getByText('No week-over-week comparison available')).toBeInTheDocument();
  });

  it('shows a skeleton, and no trend at all, until the figure arrives', () => {
    // A week-over-week badge above a value that is not there yet would be a
    // claim about nothing: the delta is derived from the same roll-up as the
    // figure, so neither is known before the other.
    const { container } = render(StatTile, {
      props: { ...base, loading: true, delta: -6, higherIsBetter: true },
    });

    expect(container.querySelector('.tile__skeleton')).not.toBeNull();
    expect(container.querySelector('.tile__value')?.textContent?.trim()).toBe('');
    expect(container.querySelector('.trend')).toBeNull();
    // The label stays: which KPI is loading is worth knowing.
    expect(screen.getByText('Avg PM2.5')).toBeInTheDocument();
  });
});
