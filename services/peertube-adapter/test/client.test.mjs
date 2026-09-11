import assert from 'node:assert/strict'
import test from 'node:test'
import { PeerTubeClient } from '../src/client.mjs'

test('client uses the pinned API boundary and backend bearer token', async () => {
  let observed
  const client = new PeerTubeClient({
    baseUrl: 'https://video.example',
    accessToken: 'test-token',
    fetchImpl: async (url, options) => {
      observed = { url: url.toString(), options }
      return { ok: true, json: async () => ({ uuid: 'video-1' }) }
    }
  })
  await client.getVideo('video-1')
  assert.equal(observed.url, 'https://video.example/api/v1/videos/video-1')
  assert.equal(observed.options.headers.authorization, 'Bearer test-token')
})

test('client rejects path injection in video IDs', async () => {
  const client = new PeerTubeClient({ baseUrl: 'https://video.example' })
  assert.throws(() => client.getVideo('../admin'), /Invalid PeerTube video ID/)
})

test('client rejects credentials embedded in the instance URL', () => {
  assert.throws(() => new PeerTubeClient({ baseUrl: 'https://user:pass@video.example' }), /must not include credentials/)
})
