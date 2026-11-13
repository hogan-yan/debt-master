// User journey test: simulated visitor browses public pages, then — when
// SESSION_COOKIE is provided — an authenticated user walks the app's main
// surfaces (expenses → payments → restaurants). Group-level thresholds let
// you see which surface degrades first.
//
//   k6 run load-tests/journey.js
//   SESSION_COOKIE="better-auth.session_token=..." k6 run load-tests/journey.js

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import {
  AUTHED_PAGES,
  authedHeaders,
  BASE_URL,
  DEFAULT_THRESHOLDS,
  PUBLIC_PAGES,
  pick,
  SESSION_COOKIE,
  thinkTime,
} from './config.js';

const journeyErrors = new Rate('journey_errors');

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 }, // ramp
        { duration: '3m', target: 10 }, // steady
        { duration: '1m', target: 20 }, // push
        { duration: '2m', target: 20 },
        { duration: '1m', target: 0 }, // drain
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    ...DEFAULT_THRESHOLDS,
    'group_duration{group:::Public browse}': ['p(95)<800'],
    ...(SESSION_COOKIE ? { 'group_duration{group:::Authed surfaces}': ['p(95)<1200'] } : {}),
  },
};

export default function () {
  const visitor = pick(['anonymous', SESSION_COOKIE ? 'authed' : 'anonymous']);

  group('Public browse', () => {
    for (const page of [pick(PUBLIC_PAGES), pick(PUBLIC_PAGES)]) {
      const res = http.get(`${BASE_URL}${page.path}`, {
        tags: { page: page.name },
      });
      check(res, { [`${page.path} is 200`]: (r) => r.status === 200 });
      journeyErrors.add(res.status !== 200);
      sleep(thinkTime());
    }
  });

  if (visitor === 'authed') {
    group('Authed surfaces', () => {
      for (const page of [pick(AUTHED_PAGES), pick(AUTHED_PAGES)]) {
        const res = http.get(`${BASE_URL}${page.path}`, {
          headers: authedHeaders(),
          tags: { page: page.name },
        });
        // 302/redirect to login means the session cookie expired mid-run —
        // count it as a failure so the run doesn't silently pass while
        // testing an anonymous cohort.
        check(res, {
          [`${page.path} is 200`]: (r) => r.status === 200,
          [`${page.path} not redirected to login`]: (r) => !r.url.includes('/login'),
        });
        journeyErrors.add(res.status !== 200);
        sleep(thinkTime());
      }
    });
  }

  sleep(thinkTime());
}
