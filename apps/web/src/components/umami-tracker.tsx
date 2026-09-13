import { useEffect, useState } from 'react';

import { getPublicAnalyticsConfig } from '@/server/analytics-config';

interface UmamiConfig {
  umamiUrl: string;
  umamiWebsiteId: string;
}

/**
 * Loads the Umami tracker in the browser once the public analytics config is
 * available. Renders nothing — the script is appended to <head> and
 * auto-tracks the initial pageview on load, then SPA navigations.
 *
 * Best-effort: config fetch failures silently disable analytics for the
 * session; the injected script's own failures never touch the app.
 */
export function UmamiTracker(): null {
  const [config, setConfig] = useState<UmamiConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicAnalyticsConfig()
      .then((c) => {
        if (!cancelled && c.umamiUrl && c.umamiWebsiteId) {
          setConfig({ umamiUrl: c.umamiUrl, umamiWebsiteId: c.umamiWebsiteId });
        }
      })
      .catch(() => {
        // analytics must never break the app
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = `${config.umamiUrl}/script.js`;
    script.setAttribute('data-website-id', config.umamiWebsiteId);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [config]);

  return null;
}
