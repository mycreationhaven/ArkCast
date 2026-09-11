# Phase 0 proof-of-concept roadmap

## Goal

Prove that ArkCast can publish, verify, pay, replicate, and survive an ordinary origin failure without placing video or sensitive user data on-chain.

## Work packages

### 0.1 Repository and trust boundaries

- Establish architecture decisions and security rules.
- Inventory licenses and document source-offer obligations.
- Inspect the Arkovia transaction, fee, account, signing, API, and confirmation implementations.
- Pin exact upstream versions after evaluation; do not track moving development branches in production.

### 0.2 Arkovia gateway

- Query multiple configured Arkovia nodes and report health without accepting arbitrary browser-supplied RPC targets.
- Define canonical publication-proof payloads.
- Add transaction preparation, broadcast, idempotency, confirmation, and reorganization handling only after repository inspection.
- Demonstrate the proposed 0.01 ARKOS minimum ordinary fee on a test network; do not assume it is already enforced.

### 0.3 Video origin

- Deploy a private PeerTube evaluation node.
- Upload and transcode one non-sensitive test video.
- Record exact PeerTube, FFmpeg, database, and object-storage versions.
- Generate a deterministic hash from the finalized publication manifest.

### 0.4 Proof and tip

- Link a test creator channel to an Arkovia public key.
- Prepare and wallet-sign one publication proof.
- Display cryptographic verification without claiming legal identity verification.
- Submit one test ARKOS tip and show amount, fee, total, and confirmation state separately.

### 0.5 Replication and failure

- Add a second controlled video node.
- Replicate the finalized video, captions, thumbnails, and required manifests.
- Verify every replica against expected hashes.
- Stop the origin and demonstrate continued playback.
- Propagate a test takedown and confirm both controlled nodes stop serving it.

## Exit criteria

Phase 0 passes only when:

- A video plays from the origin and verified replica.
- Playback survives loss of the origin.
- A corrupted replica is rejected.
- A publication proof can be independently reconstructed and verified.
- A test tip reaches the intended account with an unambiguous fee display.
- No private key or child/personal viewing data reaches ArkCast or the blockchain.
- Takedown propagation removes the test content from every controlled serving node.
- Licenses and source-distribution obligations are documented for the selected deployment model.
