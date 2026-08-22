import { render } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';

import AqiBadge from './AqiBadge.vue';

describe('AqiBadge', () => {
  it.each(['good', 'moderate', 'elevated', 'unhealthy'] as const)('renders %s', (category) => {
    const { container } = render(AqiBadge, { props: { category } });

    expect(container.querySelector(`.badge--${category}`)).not.toBeNull();
  });

  it('says "No data" rather than implying clean air', () => {
    // A station with no reading has no air quality; rendering it as "Good"
    // would be the most dangerous possible default.
    const { container } = render(AqiBadge, { props: { category: null } });

    expect(container.textContent?.trim()).toBe('No data');
    expect(container.querySelector('.badge--good')).toBeNull();
  });
});
