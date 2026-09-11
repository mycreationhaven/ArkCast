# ADR-002: Arkovia integration audit

## Status

Accepted for the Phase 0 gateway. A test-network rehearsal remains mandatory before real funds or protocol changes.

## Evidence inspected

This decision is based on the current `main` branch of `mycreationhaven/Arkovia-Blockchain`, including:

- `src/java/nxt/Constants.java`
- `src/java/nxt/Fee.java`
- `src/java/nxt/TransactionImpl.java`
- `src/java/nxt/TransactionType.java`
- `src/java/nxt/Appendix.java`
- `src/java/nxt/http/CreateTransaction.java`
- `src/java/nxt/http/SendMoney.java`
- `src/java/nxt/http/SendMessage.java`
- `src/java/nxt/http/SignTransaction.java`
- `src/java/nxt/http/BroadcastTransaction.java`
- `src/java/nxt/http/GetTransaction.java`
- `src/java/nxt/http/GetBlockchainStatus.java`
- `conf/nxt-default.properties`
- `LICENSE.txt`

## Capability matrix

| Capability | Current finding | ArkCast decision |
|---|---|---|
| Coin and account identity | `ARKOS`, account prefix `ARK` | Reuse existing accounts and public keys |
| Decimal precision | `ONE_NXT = 100000000`, giving eight decimal places | Represent every amount as an integer NQT value; never use floating point |
| Ordinary payments | `sendMoney` exists | Prepare unsigned tips; sign in the user's wallet; broadcast signed bytes |
| Arbitrary messages | `sendMessage` and permanent message appendix exist | Use a compact binary publication proof no larger than 160 bytes |
| Prunable messages | Up to 42 KiB, with a minimum retention period | Do not use for the authoritative publication proof |
| Tagged data | Existing on-chain data feature | Not needed for MVP proofs; content and metadata stay off-chain |
| Local signing | Unsigned creation and signed broadcast are supported | Never send a secret phrase to ArkCast or a remote node |
| Transaction lookup | Confirmed and unconfirmed transaction lookup exists | Track by full hash and compare results across trusted nodes |
| Chain health | Height, last block, cumulative difficulty, sync and scan states are exposed | Require a synced, non-scanning node and compare several nodes |
| 0.01 ARKOS baseline fee | Not currently implemented | Treat as a future consensus change requiring activation-height design and testnet validation |

## Fee finding

Arkovia uses eight decimal places:

```text
1 ARKOS    = 100,000,000 NQT
0.01 ARKOS =   1,000,000 NQT
```

The current default transaction fee is `Constants.ONE_NXT`, or 1 ARKOS. Transaction validation recomputes the minimum from every appendage and rejects a lower fee. Several specialized transaction and appendix types define additional explicit fee schedules.

Changing the ordinary baseline to 0.01 ARKOS changes which transactions consensus accepts. It must not be deployed as an uncoordinated constant edit. A proper proposal must include an activation height, version compatibility plan, test vectors, testnet rehearsal, block-capacity and spam analysis, and coordinated node upgrade. Every explicit fee schedule must be inventoried separately rather than divided blindly.

Until that protocol work is approved and activated, ArkCast must display the minimum returned by the active network. It must not advertise or submit 0.01 ARKOS fees against nodes that still enforce 1 ARKOS.

## Publication-proof format

A normal message is permanent but limited to 160 bytes. The original JSON envelope was too large and has been replaced with `AKVP` version 1:

| Field | Bytes |
|---|---:|
| Magic `AKVP` | 4 |
| Format version | 1 |
| Hash algorithm (`1` = SHA-256) | 1 |
| Flags | 1 |
| Reserved | 1 |
| Media-manifest SHA-256 | 32 |
| Metadata SHA-256 | 32 |
| Optional parent-proof full hash | 32 |
| Total | 72 or 104 |

The sender account and public key establish the creator signing identity. The containing block establishes network time and height. Channel ID, video ID, title, license text, URLs, and other mutable metadata remain off-chain inside the hashed metadata document. This avoids duplication, protects privacy, and fits the permanent-message limit.

## Safe transaction flow

### Publication proof

1. ArkCast finalizes and hashes the off-chain media manifest and canonical metadata document.
2. The gateway encodes the 72-byte or 104-byte `AKVP` message.
3. A trusted Arkovia node prepares an unsigned `sendMessage` transaction using the creator's public key, `messageIsText=false`, `messageIsPrunable=false`, and the network-calculated fee.
4. The wallet verifies recipient, amount, message bytes, deadline, fee, and recent-chain references.
5. The wallet signs locally.
6. The gateway broadcasts signed transaction bytes to trusted nodes without receiving the secret phrase.
7. ArkCast monitors the full hash until the configured confirmation policy is met.

### Direct tip

Use the same unsigned-create, local-sign, signed-broadcast flow with `sendMoney`. The confirmation record must separately retain the creator amount, network fee, transaction full hash, sender public account, recipient public account, observed height, and status.

## Confirmation policy

The API reports a transaction as unconfirmed or returns its block and confirmation count. ArkCast must use three application states:

- **Pending:** accepted or observed but not yet in a block.
- **Confirmed:** included and observed consistently by the required trusted-node quorum.
- **Final:** deeper than the configured settlement threshold and still agreed upon by the quorum.

No universal threshold is locked by this audit. Phase 0 should begin with conservative test values, measure normal forks and node lag, and then document separate thresholds for low-value tips, memberships, creator withdrawals, and administrative settlement. “Final” is an application risk classification, not a claim that reorganization is mathematically impossible.

## Security requirements

- Do not call the node's `signTransaction` endpoint with a user's secret phrase. Its existence does not make remote signing safe.
- Do not expose arbitrary node selection to browsers; gateway nodes are allowlisted by operators.
- Compare chain identity, last block, height, cumulative difficulty, syncing state, and transaction full hash across nodes.
- Treat scanning or downloading nodes as unavailable for financial confirmation.
- Validate unsigned transaction bytes in the wallet rather than trusting a gateway-provided summary.
- Use integer strings for NQT API fields and checked integer arithmetic internally.
- Add idempotency around broadcast and ledger ingestion using transaction full hashes.
- Keep all child data, viewing history, personal identity, and moderation evidence off-chain.

## Licensing boundary

The blockchain core is distributed under Jelurida Public License 2.0; the bundled web client is separately identified as MIT-licensed. ArkCast should interact with an independently deployed Arkovia node through its HTTP API and must not copy blockchain-core source into this repository. Any future core modification, including fee consensus changes, remains in the Arkovia repository and requires a dedicated licensing and legal review.
