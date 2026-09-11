# Arkovia gateway container runbook

This evaluation deployment runs the ArkCast gateway in a hardened Node.js 22
container on the same Linux host as the ARKOS node.

## Security boundary

- The gateway binds only to `127.0.0.1`.
- Linux host networking is intentional so the container can reach the ARKOS API
  at `127.0.0.1:4876` without exposing either service on an external interface.
- The container runs as the upstream image's unprivileged `node` user.
- The root filesystem is read-only, Linux capabilities are dropped, privilege
  escalation is disabled, and CPU, memory, PID, and temporary-storage limits
  are applied.
- No secret phrase, private key, wallet password, signed transaction, or API
  bearer token belongs in this Compose file, its environment, or the image.
- The gateway prepares and verifies publication proofs. Signing and broadcasting
  remain separately approved, user-controlled operations.

`network_mode: host` is Linux-specific. Do not deploy this Compose definition on
Docker Desktop or a shared multi-tenant host without a new network review.

## Start

From the repository root:

```bash
cp deploy/arkovia-gateway/.env.example deploy/arkovia-gateway/.env
docker compose --env-file deploy/arkovia-gateway/.env \
  -f deploy/arkovia-gateway/compose.yaml config
docker compose --env-file deploy/arkovia-gateway/.env \
  -f deploy/arkovia-gateway/compose.yaml up --build -d
```

## Verify

```bash
docker compose -f deploy/arkovia-gateway/compose.yaml ps
curl --fail --silent http://127.0.0.1:8787/health
curl --fail --silent http://127.0.0.1:8787/api/v1/blockchain/health
```

The service health response must report `ok`. The blockchain health response
must report at least one healthy node and identify only the configured local
ARKOS endpoint.

Confirm that the gateway is not listening on a public address:

```bash
ss -ltnp | grep ':8787'
```

The listener must be `127.0.0.1:8787`, never `0.0.0.0:8787` or `[::]:8787`.

## Stop

```bash
docker compose -f deploy/arkovia-gateway/compose.yaml down
```

Stopping the gateway does not stop or modify the ARKOS node.
