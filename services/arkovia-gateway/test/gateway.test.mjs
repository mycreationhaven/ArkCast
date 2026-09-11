import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { canonicalizeProof, encodeOnChainProof, preparePublicationProof } from '../src/proof.mjs'
import { createGatewayServer, loadConfig, prepareProofFromManifest, probeNode } from '../src/server.mjs'
import {
  monitorTransaction,
  prepareUnsignedPublicationTransaction,
  rejectSigningMaterial
} from '../src/transactions.mjs'

const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)

test('publication proof has deterministic canonical order', () => {
  const proof = preparePublicationProof({
    videoId: 'video-1', channelId: 'channel-1', metadataSha256: hashB,
    mediaSha256: hashA, license: 'CC-BY-4.0'
  })
  assert.equal(canonicalizeProof(proof),
    `{"schema":"arkcast.video-proof.v1","channelId":"channel-1","videoId":"video-1","mediaSha256":"${hashA}","metadataSha256":"${hashB}","license":"CC-BY-4.0"}`)
})

test('publication proof rejects malformed hashes', () => {
  assert.throws(() => preparePublicationProof({
    channelId: 'channel-1', videoId: 'video-1',
    mediaSha256: 'not-a-hash', metadataSha256: hashB
  }), /Invalid mediaSha256/)
})

test('on-chain proof is permanent and fits the 160-byte Arkovia message limit', () => {
  const proof = preparePublicationProof({
    channelId: 'channel-1', videoId: 'video-1',
    mediaSha256: hashA, metadataSha256: hashB,
    parentProofHash: 'c'.repeat(64)
  })
  const encoded = encodeOnChainProof(proof)
  assert.equal(encoded.messageIsPrunable, false)
  assert.equal(encoded.messageIsText, false)
  assert.equal(encoded.bytes, 104)
  assert.equal(Buffer.from(encoded.value, 'hex').subarray(0, 4).toString('ascii'), 'AKVP')
})

test('node probe exposes only selected non-sensitive status fields', async () => {
  const result = await probeNode('https://node.example', '/nxt?requestType=getBlockchainStatus', 50, async () => ({
    ok: true,
    json: async () => ({ numberOfBlocks: 42, isDownloading: false, isScanning: false, secret: 'ignored' })
  }))
  assert.equal(result.healthy, true)
  assert.equal(result.height, 42)
  assert.equal('secret' in result, false)
})

test('gateway rejects signing material instead of accepting or copying it', async t => {
  const config = loadConfig({
    ARKOVIA_NODE_URLS: 'https://node.example',
    ARKCAST_GATEWAY_HOST: '127.0.0.1',
    ARKCAST_GATEWAY_PORT: '0'
  })
  const server = createGatewayServer(config)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())

  const address = server.address()
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/proofs/prepare`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channelId: 'channel-1', videoId: 'video-1',
      mediaSha256: hashA, metadataSha256: hashB,
      seedPhrase: 'must never be echoed'
    })
  })
  assert.equal(response.status, 400)
  const body = await response.json()
  assert.match(body.error, /signing material is forbidden/)
})


test('gateway derives a proof from a validated publication manifest', () => {
  const result = prepareProofFromManifest({
    manifest: {
      source: { instanceId: 'node2-evaluation', videoId: 'video-1' },
      channelId: 'channel-1',
      durationSeconds: 55,
      assets: [
        { kind: 'web-video', mimeType: 'video/mp4', resolution: 1440, sizeBytes: 200, sha256: hashB },
        { kind: 'source', mimeType: 'video/mp4', sizeBytes: 100, sha256: hashA }
      ]
    }
  })
  assert.equal(result.proof.mediaSha256, hashA)
  assert.equal(result.proof.metadataSha256, result.manifestSha256)
  assert.equal(result.onChainMessage.bytes, 72)
  assert.equal(result.manifest.source.provider, 'peertube')
})

test('manifest proof requires exactly one source asset', () => {
  assert.throws(() => prepareProofFromManifest({
    manifest: {
      source: { instanceId: 'node2-evaluation', videoId: 'video-1' },
      channelId: 'channel-1',
      durationSeconds: 55,
      assets: [
        { kind: 'web-video', mimeType: 'video/mp4', sizeBytes: 200, sha256: hashB }
      ]
    }
  }), /exactly one source asset/)
})

test('signing material detection is recursive and case insensitive', () => {
  assert.throws(() => rejectSigningMaterial({ wallet: { secret_phrase: 'never' } }),
    /signing material is forbidden/)
})

test('gateway prepares and reparses an unsigned publication transaction', async () => {
  const proofResult = prepareProofFromManifest({
    manifest: {
      source: { instanceId: 'node2-evaluation', videoId: 'video-1' },
      channelId: 'channel-1', durationSeconds: 55,
      assets: [{ kind: 'source', mimeType: 'video/mp4', sizeBytes: 100, sha256: hashA }]
    }
  })
  const publicKey = '1'.repeat(64)
  const account = 'ARK-73PZ-GB9A-5BP7-22UZU'
  const transaction = {
    senderPublicKey: publicKey, senderRS: account, recipientRS: account,
    amountNQT: '0', feeNQT: '300000000', deadline: 60,
    attachment: {
      'version.Message': 1, messageIsText: false,
      message: proofResult.onChainMessage.value
    }
  }
  let calls = 0
  const fetchImpl = async (_url, options) => {
    calls += 1
    const request = new URLSearchParams(options.body)
    if (calls === 1) {
      assert.equal(request.get('requestType'), 'sendMessage')
      assert.equal(request.get('broadcast'), 'false')
      assert.equal(request.get('messageIsPrunable'), 'false')
      return { ok: true, json: async () => ({ unsignedTransactionBytes: 'ab'.repeat(253), transactionJSON: transaction }) }
    }
    assert.equal(request.get('requestType'), 'parseTransaction')
    return { ok: true, json: async () => ({ ...transaction, verify: false }) }
  }
  const result = await prepareUnsignedPublicationTransaction(
    { publicKey, account, manifest: proofResult.manifest }, proofResult,
    { nodeUrls: ['https://node.example'], timeoutMs: 50, maxFeeNQT: '300000000' }, fetchImpl)
  assert.equal(result.transaction.feeNQT, '300000000')
  assert.equal(result.unsignedTransactionBytes.length, 506)
  assert.equal(calls, 2)
})

test('unsigned transaction preparation rejects a fee above the configured ceiling', async () => {
  const proofResult = prepareProofFromManifest({
    manifest: {
      source: { instanceId: 'node2-evaluation', videoId: 'video-1' },
      channelId: 'channel-1', durationSeconds: 55,
      assets: [{ kind: 'source', mimeType: 'video/mp4', sizeBytes: 100, sha256: hashA }]
    }
  })
  const publicKey = '1'.repeat(64)
  const account = 'ARK-73PZ-GB9A-5BP7-22UZU'
  const fetchImpl = async () => ({ ok: true, json: async () => ({
    unsignedTransactionBytes: 'ab',
    transactionJSON: {
      senderPublicKey: publicKey, senderRS: account, recipientRS: account,
      amountNQT: '0', feeNQT: '300000001', deadline: 60,
      attachment: { 'version.Message': 1, messageIsText: false, message: proofResult.onChainMessage.value }
    }
  }) })
  await assert.rejects(() => prepareUnsignedPublicationTransaction(
    { publicKey, account }, proofResult,
    { nodeUrls: ['https://node.example'], timeoutMs: 50, maxFeeNQT: '300000000' }, fetchImpl),
  /fee exceeds/)
})

test('transaction monitor reports the minimum agreed confirmation count', async () => {
  const responses = new Map([
    ['https://node-a.example', 7], ['https://node-b.example', 5]
  ])
  const result = await monitorTransaction('6590125187590132918', {
    nodeUrls: [...responses.keys()], timeoutMs: 50
  }, async url => ({ ok: true, json: async () => ({
    transaction: '6590125187590132918', fullHash: hashA,
    block: '8389024868894587491', height: 20564,
    confirmations: responses.get(url.origin), senderRS: 'ARK-SENDER',
    recipientRS: 'ARK-RECIPIENT', amountNQT: '0', feeNQT: '300000000'
  }) }))
  assert.equal(result.status, 'confirmed')
  assert.equal(result.confirmations, 5)
  assert.equal(result.observedNodes, 2)
})

test('transaction monitor surfaces disagreement between trusted nodes', async () => {
  let calls = 0
  const result = await monitorTransaction('6590125187590132918', {
    nodeUrls: ['https://node-a.example', 'https://node-b.example'], timeoutMs: 50
  }, async () => ({ ok: true, json: async () => ({
    transaction: '6590125187590132918', fullHash: hashA,
    block: String(++calls), confirmations: 1
  }) }))
  assert.equal(result.status, 'inconsistent')
})

test('transaction monitor distinguishes node failure from a missing transaction', async () => {
  const config = { nodeUrls: ['https://node.example'], timeoutMs: 50 }
  const unavailable = await monitorTransaction('6590125187590132918', config,
    async () => { throw new Error('connection refused') })
  assert.equal(unavailable.status, 'unavailable')

  const missing = await monitorTransaction('6590125187590132918', config,
    async () => ({ ok: true, json: async () => ({ errorCode: 5, errorDescription: 'Unknown transaction' }) }))
  assert.equal(missing.status, 'not_found')
})
