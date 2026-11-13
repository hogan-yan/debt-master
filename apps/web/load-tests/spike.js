// Spike test: sudden traffic surge on top of a normal baseline — e.g. the
// landing page getting linked, or every member opening the app after a push.
//
//   BASE_URL=https://… k6 run load-tests/spike.js

import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import { BASE_URL, PUBLIC_PAGES, pick, thinkTime } from './config.js';

const spikeErrors = new Rate('spike_errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // normal
    { duration: '1m', target: 10 },
    { duration: '15s', target: 100 }, // spike!
    { duration: '2m', target: 100 },
    { duration: '30s', target: 10 }, // back to normal
    { duration: '2m', target: 10 }, // recovery watch
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const page = pick(PUBLIC_PAGES);
  const res = http.get(`${BASE_URL}${page.path}`, {
    tags: { page: page.name },
  });

  check(res, { [`${page.path} is 200`]: (r) => r.status === 200 });
  spikeErrors.add(res.status !== 200);

  sleep(thinkTime());
}
