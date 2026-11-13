// Soak test: sustained moderate load to surface slow leaks (connection pool
// exhaustion, memory growth, Valkey bucket drift). Default 30 minutes; for
// the full overnight run override the env var:
//
//   SOAK_DURATION=8h k6 run load-tests/soak.js

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { BASE_URL, PUBLIC_PAGES, pick, thinkTime } from './config.js';

const soakErrors = new Rate('soak_errors');

export const options = {
  stages: [
    { duration: '5m', target: 10 }, // ramp
    { duration: __ENV.SOAK_DURATION || '30m', target: 10 }, // sustained
    { duration: '5m', target: 0 }, // drain
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const page = pick(PUBLIC_PAGES);
  const res = http.get(`${BASE_URL}${page.path}`, {
    tags: { page: page.name },
  });

  check(res, { [`${page.path} is 200`]: (r) => r.status === 200 });
  soakErrors.add(res.status !== 200);

  sleep(thinkTime());
}
