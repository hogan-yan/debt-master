# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately. Do not open a public issue for anything you believe is exploitable.

Email **SECURITY_EMAIL** with:

- A short description of the issue
- Steps to reproduce, or a proof of concept
- The commit or image version you tested against

> **Owner note:** replace `SECURITY_EMAIL` with the real contact address before this repository is published.

You will get an acknowledgement, and we will work with you on a fix and a disclosure timeline.

## Supported versions

Only the latest code on `main` is supported. Security fixes land on `main` and ship in the next published release.

## For self-hosters

Run the latest published image. Upgrades are pull and recreate, and your data in the `db-data` volume is untouched:

```sh
docker compose pull
docker compose up -d
```

One data caveat: with the default `STORAGE_PROVIDER=localfs`, uploaded receipts live on the app container's filesystem and do not survive container recreation unless you add a `./storage` mount (see [docs/self-hosting.md](docs/self-hosting.md)).
