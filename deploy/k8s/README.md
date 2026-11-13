# Kubernetes manifests

Reference manifests for self-hosting Debt Master on Kubernetes. They describe
the desired state — apply them, adapt namespaces/hosts to your cluster, and
diff against your live objects when you tune them.

## What's here

- `deployment.yaml` — the `debt-master` Deployment: app container +
  `debt-master-migrate` init container (`prisma migrate deploy`),
  liveness/readiness probes on **`/health`**, pod anti-affinity, `envFrom`
  references into ConfigMaps/Secrets you create in your namespace.
- `service.yaml` — a `List` of Services: the app Service (`debt-master-service`,
  port 80 → 3000) plus reference Services for the backing components (Valkey,
  Postgres via CloudNativePG) the deployment expects to find by name.

## Conventions

- Images are placeholders (`ghcr.io/OWNER/IMAGE:PLACEHOLDER`). Replace them
  with the image your CI publishes (e.g. the GHCR image from this repo's
  workflow), or pin an exact digest at deploy time with
  `kubectl set image …@sha256:…`.
- Secrets are never in this repo. The Deployment pulls its configuration from
  `envFrom`: a `debt-master-config` ConfigMap plus `<name>-decoded`/plain
  Secrets (`database`, `authentik`, `minio`, `valkey-auth`, `jwt`,
  `turn-credentials`). The keys they must carry match the variables documented
  in `.env.example` (see the root README's environment table).
- The namespace in the files (`debt-master-prod`) is an example. For another
  namespace, apply with `-n <namespace>` or edit the field before applying.
- The `ghcr-registry-credentials` image-pull Secret is only needed if you pull
  from a private registry — `docker login ghcr.io` with a PAT that can read
  packages, then create a `kubernetes.io/dockerconfigjson` Secret from it.

## Notes for running it

- Schema migrations run in the init container; `SKIP_SEED=true` and
  `RUN_MIGRATIONS_ON_START=false` in the `debt-master-config` ConfigMap keep
  seeding and in-process migrations off (the init container owns schema).
- If you manage the manifests by hand afterwards, re-export any manual
  `kubectl patch`/`edit` back into these files so the repo stays the source
  of truth.
