import { render, screen } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';

import ConnectionBadge from './ConnectionBadge.vue';

describe('ConnectionBadge', () => {
  it.each([
    ['hq' as const, 0.96, 'HQ link 96%'],
    ['poor' as const, 0.81, 'Poor link 81%'],
    ['offline' as const, 0.86, 'Offline 86%'],
  ])('renders the %s state', (state, stability, expected) => {
    const { container } = render(ConnectionBadge, { props: { state, stability } });

    expect(container.textContent).toContain(expected);
    expect(container.querySelector(`.link--${state}`)).not.toBeNull();
  });

  it('does not rely on colour alone to convey the state', () => {
    render(ConnectionBadge, { props: { state: 'poor', stability: 0.81 } });

    expect(screen.getByText('Connection: Poor link, 81% stability')).toBeInTheDocument();
  });
});
