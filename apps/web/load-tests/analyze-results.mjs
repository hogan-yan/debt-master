#!/usr/bin/env node
// Aggregates a k6 JSON output file into a pass/fail summary.
//
//   k6 run --out json=results.json load-tests/journey.js
//   node load-tests/analyze-results.js results.json
//
// Exits 1 when the run misses the same bars the k6 thresholds assert, so it
// can gate CI or a deploy script on its own.
import fs from 'node:fs';

const LIMITS = { p95: 800, p99: 1500, errorRate: 0.01 };

const file = process.argv[2];
if (!file) {
  console.log('Usage: node analyze-results.js <k6-results.json>');
  process.exit(2);
}

const durations = [];
let requests = 0;
let failures = 0;

for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue; // skip truncated trailing lines
  }
  if (entry.type !== 'Point') continue;
  if (entry.metric === 'http_req_duration') durations.push(entry.data.value);
  if (entry.metric === 'http_reqs') requests += entry.data.value;
  if (entry.metric === 'http_req_failed' && entry.data.value === 1) failures += 1;
}

if (durations.length === 0) {
  console.log('No http_req_duration points found — was this a k6 JSON output file?');
  process.exit(2);
}

durations.sort((a, b) => a - b);
const percentile = (p) =>
  durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))];
const summary = {
  requests,
  errorRate: requests > 0 ? failures / requests : 0,
  avg: durations.reduce((a, b) => a + b, 0) / durations.length,
  p95: percentile(95),
  p99: percentile(99),
  max: durations[durations.length - 1],
};

console.log(JSON.stringify(summary, null, 2));

const passed =
  summary.p95 < LIMITS.p95 && summary.p99 < LIMITS.p99 && summary.errorRate < LIMITS.errorRate;

console.log(
  passed
    ? `PASS — p95/p99/error within limits (p95<${LIMITS.p95}ms, p99<${LIMITS.p99}ms, errors<${LIMITS.errorRate * 100}%)`
    : `FAIL — exceeds limits (p95<${LIMITS.p95}ms, p99<${LIMITS.p99}ms, errors<${LIMITS.errorRate * 100}%)`
);

process.exit(passed ? 0 : 1);
