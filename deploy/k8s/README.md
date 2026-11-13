# Kubernetes manifests (source of truth)

These manifests mirror the live deployments in `debt-master-prod` and
`debt-master-dev` (same shape, different namespace). They exist so the
desired state is version-controlled and diffable — the live objects were
previously hand-patched with nothing in the repo to compare against.

## What's here

- `deployment.yaml` — the `debt-master` Deployment: app container + `debt-master-migrate`
  init container (`prisma migrate deploy`), liveness/readiness probes on
  **`/health`**, pod anti-affinity, `envFrom` references into external
  ConfigMaps/Secrets.
- `service.yaml` — the cluster Service (port 80 → 3000).

## Conventions

- Images are placeholders (`ghcr.io/OWNER/IMAGE:PLACEHOLDER`). CI pins the
  exact GHCR digest at deploy time (`kubectl set image …@sha256:…`).
- Secrets are never in this repo. Config lives in the `debt-master-config`
  ConfigMap and the `*-decoded` Secrets in each namespace, owned by the
  external `k3s-terraform` infra repo. Required keys are documented in
  `docs/DEPLOYMENT.md`.
- The namespace field reflects prod. For dev, apply with
  `-n debt-master-dev` (namespace in the file is overridden) or sed it.

## Sync procedure (keep this file honest)

After ANY manual `kubectl patch`/`edit` against the live deployment, export it
back here:

```sh
kubectl get deploy debt-master -n debt-master-prod -o json \
  | jq 'del(.status, .metadata.managedFields, .metadata.resourceVersion,
            .metadata.uid, .metadata.creationTimestamp, .metadata.generation,
            .metadata.annotations)' \
  | python3 -c "import json,sys,yaml; d=json.load(sys.stdin); [c.update({'image':'ghcr.io/OWNER/IMAGE:PLACEHOLDER'}) for c in d['spec']['template']['spec'].get('containers',[])+d['spec']['template']['spec'].get('initContainers',[])]; print(yaml.safe_dump(d, sort_keys=False))" \
  > deploy/k8s/deployment.yaml
```

Known live-vs-repo deltas to apply during the next deploy window:

- Probes: live objects still probe `/` (full SSR render). This repo manifest
  probes `/health` (cheap DB round-trip). Apply the probe change with
  `kubectl set env`-style patch or re-apply this manifest — see
  `docs/obsidian-vault/01-Runbooks/debt-master/rollback-deployment.md`.
- ACTION REQUIRED (2026-09-10): the prod DB's only active access code is
  unbound, and prod now denies storage reads for unbound codes unless
  `ALLOW_UNBOUND_CODE_READ=true`. Bind the code or set the flag before the
  next prod deploy — see `docs/DEPLOYMENT.md` → Pre-deploy security checklist.
- `SKIP_SEED=true` and `RUN_MIGRATIONS_ON_START=false` must stay set in the
  `debt-master-config` ConfigMap of BOTH namespaces — they are load-bearing
  (seed plants shared access codes; the migrate init container owns schema).
