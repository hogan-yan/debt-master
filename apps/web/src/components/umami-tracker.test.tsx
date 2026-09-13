import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetConfig = vi.hoisted(() => vi.fn());

vi.mock('@/server/analytics-config', () => ({
  getPublicAnalyticsConfig: () => mockGetConfig(),
}));

import { UmamiTracker } from './umami-tracker';

beforeEach(() => {
  mockGetConfig.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('UmamiTracker', () => {
  it('renders nothing and injects the tracker script once config resolves', async () => {
    mockGetConfig.mockResolvedValue({
      umamiUrl: 'https://umami.hoganyan.com',
      umamiWebsiteId: 'site-1',
    });
    const { container } = render(<UmamiTracker />);
    expect(container.firstChild).toBeNull();
    await waitFor(() => {
      const script = document.head.querySelector('script[data-website-id="site-1"]');
      expect(script?.getAttribute('src')).toBe('https://umami.hoganyan.com/script.js');
    });
  });

  it('injects nothing when analytics is unconfigured', async () => {
    mockGetConfig.mockResolvedValue({ umamiUrl: null, umamiWebsiteId: null });
    render(<UmamiTracker />);
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalled());
    expect(document.head.querySelector('script[data-website-id]')).toBeNull();
  });

  it('injects nothing when the config fetch fails', async () => {
    mockGetConfig.mockRejectedValue(new Error('network down'));
    const { container } = render(<UmamiTracker />);
    await waitFor(() => expect(mockGetConfig).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
    expect(document.head.querySelector('script[data-website-id]')).toBeNull();
  });
});
