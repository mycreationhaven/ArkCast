# ArkCast

ArkCast is a resilient, community-powered video network with creator payments and verification powered by ARKOS.

ArkCast is being designed as an independent media platform—not as video stored on a blockchain and not as a cosmetic PeerTube reskin. Video remains off-chain. Arkovia provides compact proofs, creator signing identities, and economic settlement.

## Phase 0

The current milestone validates the highest-risk boundaries before production development:

1. PeerTube can provide mature upload, transcoding, playback, federation, and redundancy infrastructure.
2. ArkCast can prepare compact, deterministic video-publication proofs without handling user private keys.
3. A gateway can verify blockchain-node health and later submit or monitor ARKOS transactions through multiple trusted nodes.
4. Replicated video can continue playing after an ordinary origin node is unavailable.

## Repository layout

```text
docs/
  architecture/       Architecture decisions
  phase-0-roadmap.md  Proof-of-concept sequence and acceptance criteria
  security.md         Non-negotiable security boundaries
services/
  arkovia-gateway/    Initial blockchain integration boundary
  peertube-adapter/   Narrow PeerTube REST API boundary
packages/
  publication-manifest/  Deterministic off-chain media inventory and hashing
deploy/
  arkovia-gateway/      Local-only hardened gateway container
  peertube-evaluation/   Local-only, secret-free deployment template
```

## Run the gateway

Requires Node.js 22 or newer.

```bash
cd services/arkovia-gateway
cp .env.example .env
npm test
npm start
```

Run each package's tests from its own directory. The repository currently uses only Node.js built-ins and requires no dependency installation.

For the Linux evaluation host, follow `docs/arkovia-gateway-container-runbook.md`
to build the Node.js 22 gateway container and connect it to the local ARKOS API
at `127.0.0.1:4876`. The committed deployment keeps both endpoints on loopback
and contains no wallet signing material.

The first PeerTube origin is governed by `docs/peertube-evaluation-runbook.md`. The committed template refuses moving PeerTube tags and requires an operator-verified image digest.

The first endpoints are:

- `GET /health`
- `GET /api/v1/blockchain/health`
- `POST /api/v1/proofs/prepare`
- `POST /api/v1/proofs/prepare-from-manifest`
- `POST /api/v1/transactions/prepare-publication`
- `GET /api/v1/transactions/{transaction-or-full-hash}`

The manifest proof endpoint validates and canonicalizes an ArkCast publication
manifest, selects its single source asset, hashes the manifest, and prepares the
bounded on-chain message. Proof endpoints do not accept private keys, seed
phrases, or passwords.

The publication-transaction endpoint asks an operator-configured Arkovia node
to construct unsigned bytes, parses those bytes again, and verifies the account,
public key, zero amount, fee ceiling, deadline, and permanent binary message
before returning them for local wallet signing. It never signs or broadcasts.
The transaction lookup endpoint returns allowlisted confirmation observations
from configured nodes and reports disagreement as `inconsistent`.

## Project status

Architecture and proof-of-concept work is in progress. ArkCast is not ready for public production use, real funds, children, or sensitive personal information.

## Licensing

No project-wide software license has been selected yet. Third-party components retain their respective licenses. PeerTube is AGPL-3.0; selected LBRY components may be MIT-licensed; Arkovia's Nxt-derived blockchain is governed by applicable Jelurida Public License terms. Obtain legal review before combining, modifying, or distributing third-party code.
