#!/bin/sh
set -e

echo "🔄 Starting database migration process..."

# Wait for database to be ready using DATABASE_URL
echo "⏳ Waiting for database to be ready..."
until pg_isready -d "${DATABASE_URL}"; do
  echo "Database is not ready yet. Waiting..."
  sleep 2
done

echo "✅ Database is ready!"

# Deploy migrations
echo "🚀 Deploying migrations..."
bun x prisma migrate deploy

# Seed policy (defense against credential-planting in real environments):
#   SEED_ON_START=true   → always seed (explicit override, incl. production)
#   SEED_ON_START=false  → never seed
#   SKIP_SEED=true       → never seed (legacy env, still honored)
#   unset                → seed in non-production only
# Production never seeds by default: seed.ts plants shared access codes, so a
# re-seeded production database is a credential-planting incident, not a
# convenience. Both k8s deployments already run with SKIP_SEED=true.
SHOULD_SEED=false
if [ "${SEED_ON_START}" = "true" ]; then
  SHOULD_SEED=true
elif [ "${SEED_ON_START}" = "false" ] || [ "${SKIP_SEED}" = "true" ]; then
  SHOULD_SEED=false
elif [ "${NODE_ENV}" != "production" ]; then
  SHOULD_SEED=true
fi

if [ "${SHOULD_SEED}" = "true" ]; then
  echo "🌱 Running seed data..."
  bun run prisma/seed.ts
else
  echo "⏭️  Skipping seed data (SEED_ON_START unset/false or SKIP_SEED=true in production)"
fi

echo "✅ Migration process completed successfully!" 