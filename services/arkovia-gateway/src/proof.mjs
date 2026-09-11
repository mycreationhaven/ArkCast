const HASH_PATTERN = /^[a-f0-9]{64}$/
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:+/-]{0,63}$/
const MAGIC = Buffer.from('AKVP', 'ascii')
const FORMAT_VERSION = 1
const HASH_SHA256 = 1

function requireMatch(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`Invalid ${field}`)
  }
  return value
}

export function preparePublicationProof(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Proof input must be an object')
  }

  const proof = {
    schema: 'arkcast.video-proof.v1',
    channelId: requireMatch(input.channelId, ID_PATTERN, 'channelId'),
    videoId: requireMatch(input.videoId, ID_PATTERN, 'videoId'),
    mediaSha256: requireMatch(input.mediaSha256, HASH_PATTERN, 'mediaSha256'),
    metadataSha256: requireMatch(input.metadataSha256, HASH_PATTERN, 'metadataSha256')
  }

  if (input.license !== undefined) {
    proof.license = requireMatch(input.license, LICENSE_PATTERN, 'license')
  }
  if (input.parentProofId !== undefined) {
    proof.parentProofId = requireMatch(input.parentProofId, ID_PATTERN, 'parentProofId')
  }
  if (input.parentProofHash !== undefined) {
    proof.parentProofHash = requireMatch(input.parentProofHash, HASH_PATTERN, 'parentProofHash')
  }
  return proof
}

export function canonicalizeProof(proof) {
  return JSON.stringify(proof)
}

export function encodeOnChainProof(proof) {
  const hasParent = proof.parentProofHash !== undefined
  const header = Buffer.from([FORMAT_VERSION, HASH_SHA256, hasParent ? 1 : 0, 0])
  const parts = [
    MAGIC,
    header,
    Buffer.from(proof.mediaSha256, 'hex'),
    Buffer.from(proof.metadataSha256, 'hex')
  ]
  if (hasParent) parts.push(Buffer.from(proof.parentProofHash, 'hex'))

  const payload = Buffer.concat(parts)
  if (payload.length > 160) throw new RangeError('On-chain proof exceeds Arkovia message limit')
  return {
    encoding: 'hex',
    messageIsText: false,
    messageIsPrunable: false,
    bytes: payload.length,
    value: payload.toString('hex')
  }
}
