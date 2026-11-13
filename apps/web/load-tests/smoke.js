// Smoke / baseline test: 1 VU walks every public page once each.
// Use for a quick sanity check and to record per-page baselines:
//   k6 run load-tests/smoke.js

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, PUBLIC_PAGES } from './config.js';

const pageDuration = new Trend('page_duration', true);
const pageErrors = new Rate('page_errors');

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    page_errors: ['rate<0.01'],
  },
};

export default function () {
  const page = PUBLIC_PAGES[Math.floor(Math.random() * PUBLIC_PAGES.length)];

  const res = http.get(`${BASE_URL}${page.path}`, {
    tags: { page: page.name },
  });

  check(res, {
    [`${page.path} status is 200`]: (r) => r.status === 200,
    [`${page.path} returned HTML`]: (r) => r.headers['Content-Type']?.includes('text/html'),
  });

  pageDuration.add(res.timings.duration, { page: page.name });
  pageErrors.add(res.status !== 200);

  sleep(1);
}
