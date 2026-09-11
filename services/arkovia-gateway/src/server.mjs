import http from 'node:http'
import { pathToFileURL } from 'node:url'
import {
  buildPublicationManifest,
  canonicalizeManifest,
  hashPublicationManifest
} from '../../../packages/publication-manifest/src/index.mjs'
import { canonicalizeProof, encodeOnChainProof, preparePublicationProof } from './proof.mjs'
import {
  monitorTransaction,
  prepareUnsignedPublicationTransaction,
  rejectSigningMaterial
} from './transactions.mjs'

const DEFAULT_TIMEOUT_MS = 3000
const MAX_BODY_BYTES = 2 * 1024 * 1024

export function loadConfig(env = process.env) {
  const rawUrls = (env.ARKOVIA_NODE_URLS || 'http://127.0.0.1:27876')
    .split(',').map(value => value.trim()).filter(Boolean)

  const nodeUrls = rawUrls.map(value => {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Arkovia node URLs must use HTTP or HTTPS')
    }
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  })

  return {
    nodeUrls: [...new Set(nodeUrls)],
    healthPath: env.ARKOVIA_HEALTH_PATH || '/nxt?requestType=getBlockchainStatus',
    timeoutMs: Number.parseInt(env.ARKOVIA_REQUEST_TIMEOUT_MS || `${DEFAULT_TIMEOUT_MS}`, 10),
    host: env.ARKCAST_GATEWAY_HOST || '127.0.0.1',
    port: Number.parseInt(env.ARKCAST_GATEWAY_PORT || '8787', 10),
    maxFeeNQT: env.ARKOVIA_MAX_PUBLICATION_FEE_NQT || '300000000'
  }
}

export async function probeNode(baseUrl, healthPath, timeoutMs, fetchImpl = fetch) {
  const endpoint = new URL(healthPath, `${baseUrl}/`)
  const startedAt = Date.now()
  try {
    const response = await fetchImpl(endpoint, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const status = await response.json()
    return {
      node: baseUrl,
      healthy: !status.errorCode,
      latencyMs: Date.now() - startedAt,
      height: Number.isSafeInteger(status.numberOfBlocks) ? status.numberOfBlocks : null,
      downloading: status.isDownloading === true,
      scanning: status.isScanning === true
    }
  } catch (error) {
    return {
      node: baseUrl,
      healthy: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Node request failed'
    }
  }
}

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body)
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  })
  response.end(payload)
}

async function readJson(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new RangeError('Request body is too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function prepareProofFromManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Request input must be an object')
  }
  const manifest = buildPublicationManifest(input.manifest)
  const sourceAssets = manifest.assets.filter(asset => asset.kind === 'source')
  if (sourceAssets.length !== 1) {
    throw new TypeError('Manifest must contain exactly one source asset')
  }
  const manifestSha256 = hashPublicationManifest(manifest)
  const proof = preparePublicationProof({
    channelId: manifest.channelId,
    videoId: manifest.source.videoId,
    mediaSha256: sourceAssets[0].sha256,
    metadataSha256: manifestSha256,
    ...(input.license === undefined ? {} : { license: input.license })
  })
  return {
    manifest,
    canonicalManifest: canonicalizeManifest(manifest),
    manifestSha256,
    proof,
    canonicalPayload: canonicalizeProof(proof),
    onChainMessage: encodeOnChainProof(proof)
  }
}

export function createHandler(config, fetchImpl = fetch) {
  return async function handler(request, response) {
    const url = new URL(request.url, 'http://gateway.local')

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { service: 'arkovia-gateway', status: 'ok' })
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/blockchain/health') {
      const nodes = await Promise.all(
        config.nodeUrls.map(node => probeNode(node, config.healthPath, config.timeoutMs, fetchImpl))
      )
      const healthyNodes = nodes.filter(node => node.healthy).length
      return sendJson(response, healthyNodes > 0 ? 200 : 503, {
        status: healthyNodes > 0 ? 'available' : 'unavailable',
        healthyNodes,
        configuredNodes: nodes.length,
        nodes
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/proofs/prepare') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        return sendJson(response, 415, { error: 'Content-Type must be application/json' })
      }
      try {
        const input = await readJson(request)
        rejectSigningMaterial(input)
        const proof = preparePublicationProof(input)
        return sendJson(response, 200, {
          proof,
          canonicalPayload: canonicalizeProof(proof),
          onChainMessage: encodeOnChainProof(proof),
          signing: 'Build and sign the containing Arkovia transaction in a user-controlled wallet.'
        })
      } catch (error) {
        return sendJson(response, error instanceof RangeError ? 413 : 400, {
          error: error instanceof Error ? error.message : 'Invalid request'
        })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/proofs/prepare-from-manifest') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        return sendJson(response, 415, { error: 'Content-Type must be application/json' })
      }
      try {
        const input = await readJson(request)
        rejectSigningMaterial(input)
        return sendJson(response, 200, {
          ...prepareProofFromManifest(input),
          signing: 'Build and sign the containing Arkovia transaction in a user-controlled wallet.'
        })
      } catch (error) {
        return sendJson(response, error instanceof RangeError ? 413 : 400, {
          error: error instanceof Error ? error.message : 'Invalid request'
        })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/transactions/prepare-publication') {
      if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
        return sendJson(response, 415, { error: 'Content-Type must be application/json' })
      }
      try {
        const input = await readJson(request)
        rejectSigningMaterial(input)
        const proofResult = prepareProofFromManifest(input)
        return sendJson(response, 200,
          await prepareUnsignedPublicationTransaction(input, proofResult, config, fetchImpl))
      } catch (error) {
        return sendJson(response, error instanceof RangeError ? 422 : 400, {
          error: error instanceof Error ? error.message : 'Invalid request'
        })
      }
    }

    const transactionMatch = url.pathname.match(/^\/api\/v1\/transactions\/([a-f0-9]{64}|[0-9]{1,20})$/)
    if (request.method === 'GET' && transactionMatch) {
      const result = await monitorTransaction(transactionMatch[1], config, fetchImpl)
      return sendJson(response, result.status === 'not_found' ? 404 : 200, result)
    }

    return sendJson(response, 404, { error: 'Not found' })
  }
}

export function createGatewayServer(config = loadConfig(), fetchImpl = fetch) {
  return http.createServer(createHandler(config, fetchImpl))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const config = loadConfig()
  createGatewayServer(config).listen(config.port, config.host, () => {
    console.log(`ArkCast Arkovia gateway listening on http://${config.host}:${config.port}`)
  })
}
