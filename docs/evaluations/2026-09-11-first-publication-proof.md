# First controlled publication proof

Date: 2026-09-11  
Environment: Node 2 local-only PeerTube evaluation  
PeerTube version: 8.2.4  
PeerTube image: `chocobozzz/peertube@sha256:a23e3fa8b58a721ad7555da649cbf513d816d150db21cfa5747315bb8e82262d`

This report records the first end-to-end ArkCast evaluation from a controlled
PeerTube upload through a permanent Arkovia proof. The PeerTube origin was
bound to `127.0.0.1:9000`; this was not a public production deployment.

## Publication

- Video UUID: `9dddf64a-33d2-4a08-b639-e3d1bc35e79f`
- PeerTube short ID: `kuE8SxNaTwU5TSavHctVdK`
- Channel ID: `arkosevaluation`
- Duration: 55 seconds
- Published rendition: 1440p, 30 FPS
- Stable inventory: confirmed by two identical observations
- Canonical manifest: [2026-09-11-first-publication-manifest.json](./2026-09-11-first-publication-manifest.json)
- Manifest SHA-256: `a2e4204e763888c66d64ec011c76d32ac04640f09fb17c7e7e9b746a5669a30f`
- Original media SHA-256: `fd6d8f2fad02d478364139beadcdfa335aac9f80a6986588e3635210f951f648`

## Arkovia proof

- Network: Arkovia mainnet
- Transaction ID: `6590125187590132918`
- Full hash: `b614aa2ff1d3745b334dc7a88a340f284532730ff6559765f18dad5906787257`
- Block ID: `8389024868894587491`
- Observed block height: `20564`
- Observed confirmations: `3`
- Sender and recipient: `ARK-73PZ-GB9A-5BP7-22UZU`
- Amount: `0 NQT`
- Fee: `300000000 NQT`
- Message encoding: binary hexadecimal
- Message storage: permanent and non-prunable
- Payload size: 72 bytes

Encoded payload:

```text
414b565001010000fd6d8f2fad02d478364139beadcdfa335aac9f80a6986588e3635210f951f648a2e4204e763888c66d64ec011c76d32ac04640f09fb17c7e7e9b746a5669a30f
```

No wallet secret phrase, private key, administrator password, or API token is
stored in this report.
