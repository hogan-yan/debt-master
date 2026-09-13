/**
 * E2E Coverage Orchestrator
 *
 * 1. Starts the Vite dev server with Istanbul instrumentation
 * 2. Runs Vitest E2E tests with coverage
 * 3. Runs standalone Playwright E2E tests
 * 4. Kills dev server (triggers coverage write to disk via process.on('exit'))
 * 5. Merges all coverage reports
 *
 * Usage: bun run scripts/e2e-coverage.ts
 */

import { existsSync } from 'node:fs';
import { type Subprocess, spawn } from 'bun';

const SERVER_URL = 'http://localhost:3000';
const MAX_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;

let serverProcess: Subprocess | null = null;

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 200) {
        console.log(`  Server ready at ${url} (${Date.now() - start}ms)`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Server did not start within ${timeoutMs / 1000}s`);
}

async function runCommand(label: string, cmd: string[]): Promise<number> {
  console.log(`\n${label}`);
  const proc = spawn({
    cmd,
    stdout: 'inherit',
    stderr: 'inherit',
    env: { ...process.env, APP_URL: SERVER_URL },
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.log(`  ${label} exited with code ${exitCode}`);
  }
  return exitCode;
}

async function shutdownServer(): Promise<void> {
  if (!serverProcess) return;
  console.log('\nShutting down dev server (writes coverage on exit)...');
  serverProcess.kill();
  await serverProcess.exited;
  serverProcess = null;

  // Brief pause for coverage file to flush
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (existsSync('./coverage/e2e-server/coverage-final.json')) {
    console.log('  Server coverage written to coverage/e2e-server/coverage-final.json');
  } else {
    console.log('  WARNING: No server coverage file found');
  }
}

process.on('SIGINT', async () => {
  await shutdownServer();
  process.exit(130);
});
process.on('SIGTERM', async () => {
  await shutdownServer();
  process.exit(1);
});

async function main() {
  console.log('=== E2E Coverage Pipeline ===\n');

  // 1. Start instrumented dev server
  console.log('Starting instrumented dev server...');
  serverProcess = spawn({
    cmd: ['bun', 'run', 'vite', 'dev', '--config', 'vite.coverage.config.ts'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  // 2. Wait for server
  try {
    await waitForServer(SERVER_URL, MAX_WAIT_MS);
  } catch (_error) {
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  let hasErrors = false;

  try {
    // 3. Run Vitest E2E with coverage
    const vitestExit = await runCommand('Running Vitest E2E tests...', [
      'bun',
      'run',
      'vitest',
      'run',
      '--config',
      'vitest.e2e.config.ts',
      '--coverage',
    ]);
    if (vitestExit !== 0) hasErrors = true;

    // 4. Run standalone Playwright E2E
    const playwrightExit = await runCommand('Running Playwright E2E tests...', [
      'bun',
      'run',
      'tests/e2e/run-smoke.ts',
    ]);
    if (playwrightExit !== 0) hasErrors = true;
  } finally {
    // 5. Kill dev server — triggers process.on('exit') in vite.coverage.config.ts
    await shutdownServer();
  }

  // 6. Merge coverage
  const mergeExit = await runCommand('Merging coverage reports...', [
    'bun',
    'run',
    'scripts/merge-coverage.ts',
  ]);
  if (mergeExit !== 0) hasErrors = true;

  console.log(`\n=== E2E Coverage ${hasErrors ? 'completed with errors' : 'complete'} ===`);
  process.exit(hasErrors ? 1 : 0);
}

main();
