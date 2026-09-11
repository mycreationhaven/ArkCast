# PeerTube evaluation runbook

This runbook creates a local, non-public Phase 0 origin. It is not a production deployment.

## Prerequisites

- A Linux test host with Docker Engine and Docker Compose.
- At least 4 CPU cores, 8 GiB RAM, and sufficient disposable disk for the test video and renditions.
- No production credentials, personal data, copyrighted test material, or child data.

## Prepare

1. Copy `deploy/peertube-evaluation/.env.example` to `deploy/peertube-evaluation/.env`.
2. Resolve the official PeerTube `v8.2.4` image to its immutable SHA-256 digest using a trusted registry and record the digest in `PEERTUBE_IMAGE`.
3. Generate independent random database, Redis, and PeerTube secrets. Do not reuse passwords from any other system.
4. Run:

   ```bash
   node scripts/peertube-evaluation.mjs preflight
   docker compose --env-file deploy/peertube-evaluation/.env \
     -f deploy/peertube-evaluation/compose.yaml config
   docker compose --env-file deploy/peertube-evaluation/.env \
     -f deploy/peertube-evaluation/compose.yaml up -d
   ```

The application port binds only to `127.0.0.1`, and the Compose network is internal. Access it from the test host at `http://peertube.localhost:9000` after mapping `peertube.localhost` to `127.0.0.1` locally.

## Secure the instance

1. Retrieve the generated root password from the PeerTube container logs without pasting it into issues, commits, or chat.
2. Sign in locally and replace it with a unique password held in an approved password manager.
3. Keep public registration disabled.
4. Keep federation, remote imports, livestream ingestion, plugins, and external object storage disabled for the first upload.
5. Create one clearly labeled test creator and channel with no real-world personal information.

Run `node scripts/peertube-evaluation.mjs verify` and require the exact evaluated version plus closed public signup before uploading.

## First test upload

Use a short, original, non-sensitive video created specifically for testing. Record:

- Upload start and completion time.
- PeerTube video UUID and channel identifier.
- Transcoding jobs and final states.
- Generated resolutions and MIME types.
- Source, rendition, HLS, caption, thumbnail, and preview byte sizes and SHA-256 values.
- PeerTube, FFmpeg, PostgreSQL, Redis, and container image digests.

Do not create the ArkCast publication proof until the asset inventory remains unchanged across two observations separated by at least one completed job-polling interval.

## Stop or destroy

Stop while retaining evaluation data:

```bash
docker compose --env-file deploy/peertube-evaluation/.env \
  -f deploy/peertube-evaluation/compose.yaml down
```

Destroy all disposable evaluation volumes only after preserving the non-secret test report:

```bash
docker compose --env-file deploy/peertube-evaluation/.env \
  -f deploy/peertube-evaluation/compose.yaml down --volumes
```

Volume deletion is irreversible. Confirm that the target Compose project is `arkcast-peertube-evaluation` before running it.
