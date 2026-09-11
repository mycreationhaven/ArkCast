import { createHash } from 'node:crypto'

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const HASH = /^[a-f0-9]{64}$/
const LANGUAGE = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i

function string(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new TypeError(`Invalid ${field}`)
  return value
}

function integer(value, field, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`Invalid ${field}`)
  return value
}

function asset(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid assets[${index}]`)
  return {
    kind: string(value.kind, /^(source|hls-playlist|hls-segment|web-video|thumbnail|preview)$/, `assets[${index}].kind`),
    mimeType: string(value.mimeType, MIME, `assets[${index}].mimeType`).toLowerCase(),
    sizeBytes: integer(value.sizeBytes, `assets[${index}].sizeBytes`, 1),
    sha256: string(value.sha256, HASH, `assets[${index}].sha256`),
    ...(value.resolution === undefined ? {} : { resolution: integer(value.resolution, `assets[${index}].resolution`, 1) })
  }
}

function caption(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`Invalid captions[${index}]`)
  return {
    language: string(value.language, LANGUAGE, `captions[${index}].language`).toLowerCase(),
    mimeType: string(value.mimeType, MIME, `captions[${index}].mimeType`).toLowerCase(),
    sizeBytes: integer(value.sizeBytes, `captions[${index}].sizeBytes`, 1),
    sha256: string(value.sha256, HASH, `captions[${index}].sha256`)
  }
}

const byCanonicalValue = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))

export function buildPublicationManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Manifest input must be an object')
  if (!Array.isArray(input.assets) || input.assets.length === 0) throw new TypeError('At least one asset is required')
  if (input.assets.length > 10000) throw new RangeError('Too many assets')
  if (input.captions !== undefined && !Array.isArray(input.captions)) throw new TypeError('Captions must be an array')

  return {
    schema: 'arkcast.publication-manifest.v1',
    source: {
      provider: 'peertube',
      instanceId: string(input.source?.instanceId, ID, 'source.instanceId'),
      videoId: string(input.source?.videoId, ID, 'source.videoId')
    },
    channelId: string(input.channelId, ID, 'channelId'),
    durationSeconds: integer(input.durationSeconds, 'durationSeconds', 0),
    assets: input.assets.map(asset).sort(byCanonicalValue),
    captions: (input.captions || []).map(caption).sort(byCanonicalValue)
  }
}

export function canonicalizeManifest(manifest) {
  return JSON.stringify(manifest)
}

export function hashPublicationManifest(manifest) {
  return createHash('sha256').update(canonicalizeManifest(manifest), 'utf8').digest('hex')
}
