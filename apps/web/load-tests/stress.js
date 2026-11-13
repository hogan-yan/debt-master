// Stress test: find the breaking point of the single-pod deployment.
// Steps load up in tiers and watches where p99 latency and error rate give
// way. Expect the passing tier to move after the first baseline — record it.
//
//   BASE_URL=https://… k6 run load-tests/stress.js

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { BASE_URL, PUBLIC_PAGES, pick, thinkTime } from './config.js';

const stressErrors = new Rate('stress_errors');

export const options = {
  stages: [
    { duration: '1m', target: 25 }, // normal-ish
    { duration: '3m', target: 25 },
    { duration: '1m', target: 50 }, // high
    { duration: '3m', target: 50 },
    { duration: '1m', target: 100 }, // stress
    { duration: '3m', target: 100 },
    { duration: '1m', target: 150 }, // breaking point probe
    { duration: '3m', target: 150 },
    { duration: '2m', target: 0 }, // recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const page = pick(PUBLIC_PAGES);
  const res = http.get(`${BASE_URL}${page.path}`, {
    tags: { page: page.name },
  });

  check(res, { [`${page.path} is 200`]: (r) => r.status === 200 });
  stressErrors.add(res.status !== 200);

  sleep(thinkTime());
}
