# Security boundaries

These requirements apply before feature work.

## Wallets and ARKOS

- Never request, transmit, log, or store wallet seed phrases or private keys.
- Prepare unsigned transactions server-side only when necessary; sign in a user-controlled wallet.
- Use multiple allowlisted Arkovia nodes for financially meaningful verification.
- Treat payments as pending until the required confirmation policy is satisfied.
- Make transaction processing idempotent and reconcile internal records against the chain.
- Use an append-only balanced ledger for pooled creator earnings; never rely on a mutable balance alone.

## Video processing

- Treat every upload as hostile.
- Quarantine uploads before parsing, scanning, transcoding, or publication.
- Run FFmpeg and other media processors without privileges in isolated workers with strict CPU, memory, time, network, and filesystem limits.
- Remove or warn about sensitive embedded metadata before publication.
- Hash finalized manifests and variants; never trust a community node's claim that it holds a valid replica.

## Children and families

- Never place child data, viewing history, age information, wallet addresses, or approval records on-chain.
- Disable stranger messaging and public financial identity for child profiles.
- Require server-enforced guardian approval for controlled purchases.
- Keep child profiles off-chain under a guardian account and minimize retained data.

## Nodes and federation

- Give every node a dedicated operational key distinct from an operator's personal identity.
- Authenticate manifests and policy updates.
- Apply mandatory legal/safety blocks before node preferences.
- Rate-limit federation, discovery, search, upload, comment, login, and blockchain endpoints independently.
- Do not reveal residential node locations or precise public network details unnecessarily.

## Administration

- Enforce least-privilege roles and multi-factor authentication for sensitive staff.
- Record append-only audit events for moderation, finance, node-policy, and administrator actions.
- Separate support, moderation, financial administration, and platform administration permissions.
- Store all service credentials in backend secret management; never commit production secrets.
