#!/bin/sh
set -e

# Determine what to run based on the first argument
case "$1" in
  "migrate")
    echo "🔄 Running migration mode..."
    exec ./scripts/migrate.sh
    ;;
  "app"|"")
    echo "🔄 Running pre-startup tasks..."

    # Run database migrations automatically before starting app.
    # Default OFF: in k8s the dedicated migrate init container owns migrations,
    # so the app process re-running them only adds a startup race between
    # replicas. docker-compose sets RUN_MIGRATIONS_ON_START=true explicitly.
    if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
      echo "🚀 Running database migrations..."
      ./scripts/migrate.sh
    else
      echo "⏭️  Skipping migrations (RUN_MIGRATIONS_ON_START=false)"
    fi

    echo "🚀 Starting application with Bun..."
    exec bun run ./scripts/server.ts
    ;;
  *)
    echo "Unknown command: $1"
    echo "Usage: $0 [migrate|app]"
    exit 1
    ;;
esac 