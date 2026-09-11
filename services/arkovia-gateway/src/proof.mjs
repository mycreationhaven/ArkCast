const HASH_PATTERN = /^[a-f0-9]{64}$/
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LICENSE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._:+/-]{0,63}$/

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
  return proof
}

export function canonicalizeProof(proof) {
  return JSON.stringify(proof)
}
