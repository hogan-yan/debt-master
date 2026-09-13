#!/bin/sh
# BUG-001 guard.
#
# A STATIC import of `@tanstack/start-server-core` anywhere under apps/web/src
# pulls `node:async_hooks` into the client bundle, which crashes every page
# whose graph reaches that module (login, setup and dashboard all went blank
# this way). The allowed form is `await import('@tanstack/start-server-core')`
# INSIDE a server-fn handler body: the handler is stripped from the client
# build, so the dynamic import never reaches the browser.
#
# Run via: bun run lint:server-boundary  (wired into CI's test-web job)

if grep -rn "from '@tanstack/start-server-core'" src --include='*.ts' --include='*.tsx'; then
  echo "" >&2
  echo "ERROR: static @tanstack/start-server-core import found." >&2
  echo "Use await import('@tanstack/start-server-core') inside the handler body instead." >&2
  exit 1
fi
echo "server boundary OK (no static start-server-core imports)"
