import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublicationManifest, canonicalizeManifest, hashPublicationManifest } from '../src/index.mjs'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)
const hashC = 'c'.repeat(64)

function input(assets) {
  return {
    source: { provider: 'peertube', instanceId: 'origin-1', videoId: 'video-1' },
    channelId: 'channel-1',
    durationSeconds: 120,
    assets,
    captions: [{ language: 'EN-US', mimeType: 'text/vtt', sizeBytes: 50, sha256: hashC }]
  }
}

test('manifest order and hash are deterministic', () => {
  const first = buildPublicationManifest(input([
    { kind: 'web-video', mimeType: 'video/mp4', resolution: 720, sizeBytes: 200, sha256: hashB },
    { kind: 'thumbnail', mimeType: 'image/jpeg', sizeBytes: 20, sha256: hashA }
  ]))
  const second = buildPublicationManifest(input([
    { kind: 'thumbnail', mimeType: 'image/jpeg', sizeBytes: 20, sha256: hashA },
    { kind: 'web-video', mimeType: 'video/mp4', resolution: 720, sizeBytes: 200, sha256: hashB }
  ]))
  assert.equal(canonicalizeManifest(first), canonicalizeManifest(second))
  assert.equal(hashPublicationManifest(first), hashPublicationManifest(second))
})

test('changing an asset changes the publication hash', () => {
  const original = buildPublicationManifest(input([
    { kind: 'web-video', mimeType: 'video/mp4', resolution: 720, sizeBytes: 200, sha256: hashA }
  ]))
  const changed = buildPublicationManifest(input([
    { kind: 'web-video', mimeType: 'video/mp4', resolution: 720, sizeBytes: 200, sha256: hashB }
  ]))
  assert.notEqual(hashPublicationManifest(original), hashPublicationManifest(changed))
})

test('manifest rejects unsafe or incomplete assets', () => {
  assert.throws(() => buildPublicationManifest(input([
    { kind: 'remote-url', mimeType: 'video/mp4', sizeBytes: 200, sha256: hashA }
  ])), /Invalid assets\[0\].kind/)
})
