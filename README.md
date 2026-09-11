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

The first endpoints are:

- `GET /health`
- `GET /api/v1/blockchain/health`
- `POST /api/v1/proofs/prepare`

The proof endpoint prepares a canonical payload for wallet-side signing. It does not accept private keys, seed phrases, or passwords.

## Project status

Architecture and proof-of-concept work is in progress. ArkCast is not ready for public production use, real funds, children, or sensitive personal information.

## Licensing

No project-wide software license has been selected yet. Third-party components retain their respective licenses. PeerTube is AGPL-3.0; selected LBRY components may be MIT-licensed; Arkovia's Nxt-derived blockchain is governed by applicable Jelurida Public License terms. Obtain legal review before combining, modifying, or distributing third-party code.
