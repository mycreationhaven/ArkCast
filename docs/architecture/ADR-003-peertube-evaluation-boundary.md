# ADR-003: PeerTube evaluation boundary

## Status

Accepted for Phase 0 evaluation.

## Version

Phase 0 targets PeerTube `v8.2.4`, the latest stable semantic-version tag observed when this decision was recorded. Production must pin an immutable image digest after the evaluation deployment is reproduced; it must not use `production`, `latest`, or a moving development branch.

## Decision

PeerTube supplies the initial video engine through its documented REST API and supported extension points. ArkCast owns its consumer interface, family controls, creator economy, blockchain proofs, and cross-node policy. PeerTube records are provider data, not ArkCast's authoritative financial or safety state.

The adapter initially uses:

- `GET /api/v1/videos/{id}` for finalized video information.
- `GET /api/v1/videos/{id}/captions` for caption inventory.
- PeerTube's resumable upload API in a later, separately tested step.
- PeerTube redundancy endpoints for controlled Phase 0 experiments, not as the final ArkCast community-node protocol.

## Publication manifest

ArkCast hashes a canonical manifest only after transcoding and publication assets are finalized. It contains stable identifiers and SHA-256 hashes rather than mutable delivery URLs. Its initial asset classes are source files, HLS playlists, HLS segments, web-video renditions, thumbnails, and previews. Captions are independently hashed.

Sorting is deterministic, so enumeration order from PeerTube or object storage cannot change the proof. Changing any asset hash, size, MIME type, resolution, caption, source identity, channel identity, or duration changes the manifest hash.

## Security boundary

- PeerTube access tokens remain backend-only secrets.
- Instance origins are operator configured; callers cannot supply arbitrary upstream URLs.
- Video identifiers are validated before URL construction.
- ArkCast downloads finalized assets only from allowlisted PeerTube and object-storage origins.
- Retrieved media must be streamed through bounded hashing; it must not be buffered without size limits.
- Publication waits for a stable completed-transcode state and rejects changing asset inventories.
- The adapter never treats PeerTube creator identity as an Arkovia signing identity without a separate verified link.
- The adapter never treats PeerTube privacy classification as sufficient for child safety or legal moderation.

## Licensing

PeerTube is AGPL-3.0. Phase 0 begins with an unmodified, pinned upstream deployment and a separately authored ArkCast adapter. Any PeerTube plugin, theme, patch, or fork receives an explicit license review and source-offer plan before network deployment.
