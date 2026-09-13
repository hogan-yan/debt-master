import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => {
  const createBuilder = () => {
    const builder = {
      validator: () => builder,
      inputValidator: () => builder,
      handler: (fn: () => unknown) => fn,
    };
    return builder;
  };
  return { createServerFn: () => createBuilder() };
});

import { getPublicAnalyticsConfig } from './analytics-config';

const saved = { url: process.env.UMAMI_URL, id: process.env.UMAMI_WEBSITE_ID };

describe('getPublicAnalyticsConfig', () => {
  beforeEach(() => {
    process.env.UMAMI_URL = 'https://umami.hoganyan.com';
    process.env.UMAMI_WEBSITE_ID = 'site-1';
  });

  afterEach(() => {
    if (saved.url === undefined) delete process.env.UMAMI_URL;
    else process.env.UMAMI_URL = saved.url;
    if (saved.id === undefined) delete process.env.UMAMI_WEBSITE_ID;
    else process.env.UMAMI_WEBSITE_ID = saved.id;
  });

  it('returns the public umami config from the environment', () => {
    expect(getPublicAnalyticsConfig()).toEqual({
      umamiUrl: 'https://umami.hoganyan.com',
      umamiWebsiteId: 'site-1',
    });
  });

  it('returns nulls when unconfigured so analytics stays inert', () => {
    delete process.env.UMAMI_URL;
    delete process.env.UMAMI_WEBSITE_ID;
    expect(getPublicAnalyticsConfig()).toEqual({ umamiUrl: null, umamiWebsiteId: null });
  });

  it('coerces empty env strings to nulls', () => {
    process.env.UMAMI_URL = '';
    process.env.UMAMI_WEBSITE_ID = '';
    expect(getPublicAnalyticsConfig()).toEqual({ umamiUrl: null, umamiWebsiteId: null });
  });
});
