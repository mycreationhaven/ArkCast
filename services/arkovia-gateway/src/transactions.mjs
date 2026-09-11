const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/
const ACCOUNT_PATTERN = /^ARK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{5}$/
const TRANSACTION_ID_PATTERN = /^[0-9]{1,20}$/
const FULL_HASH_PATTERN = /^[a-f0-9]{64}$/
const BYTE_PATTERN = /^[a-f0-9]+$/
const FORBIDDEN_KEYS = new Set([
  'secretphrase', 'seedphrase', 'privatekey', 'passphrase', 'password',
  'mnemonic', 'recoveryphrase', 'walletseed'
])

function requireMatch(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`Invalid ${field}`)
  }
  return value
}

function requireNqt(value, field) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,17})$/.test(value)) {
    throw new TypeError(`Invalid ${field}`)
  }
  return value
}

export function rejectSigningMaterial(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.replaceAll(/[^A-Za-z]/g, '').toLowerCase())) {
      throw new TypeError('Wallet signing material is forbidden')
    }
    rejectSigningMaterial(child)
  }
}

async function requestNode(baseUrl, parameters, timeoutMs, fetchImpl) {
  const response = await fetchImpl(new URL('/nxt', `${baseUrl}/`), {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(parameters)
  })
  if (!response.ok) throw new Error(`Arkovia node returned HTTP ${response.status}`)
  return response.json()
}

function validateTransaction(transaction, expected) {
  if (!transaction || typeof transaction !== 'object') {
    throw new Error('Arkovia node omitted transaction details')
  }
  if (transaction.senderPublicKey !== expected.publicKey ||
      transaction.senderRS !== expected.account ||
      transaction.recipientRS !== expected.account ||
      transaction.amountNQT !== '0' ||
      transaction.deadline !== expected.deadline ||
      transaction.attachment?.message !== expected.message ||
      transaction.attachment?.messageIsText !== false ||
      transaction.attachment?.['version.Message'] !== 1 ||
      transaction.attachment?.['version.PrunablePlainMessage'] !== undefined) {
    throw new Error('Arkovia node returned unexpected transaction fields')
  }
  const feeNQT = requireNqt(transaction.feeNQT, 'feeNQT')
  if (BigInt(feeNQT) === 0n || BigInt(feeNQT) > BigInt(expected.maxFeeNQT)) {
    throw new RangeError('Arkovia transaction fee exceeds the configured maximum')
  }
  return feeNQT
}

export async function prepareUnsignedPublicationTransaction(input, proofResult, config, fetchImpl = fetch) {
  rejectSigningMaterial(input)
  const publicKey = requireMatch(input.publicKey, PUBLIC_KEY_PATTERN, 'publicKey')
  const account = requireMatch(input.account, ACCOUNT_PATTERN, 'account')
  const deadline = input.deadline === undefined ? 60 : input.deadline
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 1440) {
    throw new TypeError('Invalid deadline')
  }
  const maxFeeNQT = requireNqt(config.maxFeeNQT, 'configured maximum fee')
  const message = proofResult.onChainMessage.value
  let lastError

  for (const node of config.nodeUrls) {
    try {
      const created = await requestNode(node, {
        requestType: 'sendMessage', publicKey, recipient: account,
        amountNQT: '0', feeNQT: '0', deadline: String(deadline), message,
        messageIsText: 'false', messageIsPrunable: 'false', broadcast: 'false'
      }, config.timeoutMs, fetchImpl)
      if (created.errorCode !== undefined) {
        throw new Error(created.errorDescription || `Arkovia error ${created.errorCode}`)
      }
      const bytes = requireMatch(created.unsignedTransactionBytes, BYTE_PATTERN, 'unsignedTransactionBytes')
      if (bytes.length % 2 !== 0 || bytes.length > 4096) {
        throw new TypeError('Invalid unsignedTransactionBytes')
      }
      const expected = { publicKey, account, deadline, message, maxFeeNQT }
      const createdFee = validateTransaction(created.transactionJSON, expected)
      const parsed = await requestNode(node, {
        requestType: 'parseTransaction', transactionBytes: bytes
      }, config.timeoutMs, fetchImpl)
      if (parsed.errorCode !== undefined) {
        throw new Error(parsed.errorDescription || `Arkovia error ${parsed.errorCode}`)
      }
      const parsedFee = validateTransaction(parsed, expected)
      if (parsedFee !== createdFee || parsed.verify !== false) {
        throw new Error('Unsigned transaction validation failed')
      }
      return {
        node,
        unsignedTransactionBytes: bytes,
        transaction: {
          senderPublicKey: publicKey,
          senderRS: account,
          recipientRS: account,
          amountNQT: '0',
          feeNQT: createdFee,
          deadline,
          attachment: {
            message,
            messageIsText: false,
            messageIsPrunable: false
          }
        },
        proof: proofResult,
        signing: 'Verify these fields and sign locally in a user-controlled wallet. Do not return a secret phrase to ArkCast.'
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('No Arkovia nodes are configured')
}

function sanitizeLookup(node, result) {
  if (result.errorCode !== undefined) {
    return {
      node,
      found: false,
      notFound: result.errorCode === 5,
      error: result.errorDescription || `Arkovia error ${result.errorCode}`
    }
  }
  const fullHash = requireMatch(result.fullHash, FULL_HASH_PATTERN, 'fullHash')
  return {
    node,
    found: true,
    transaction: requireMatch(result.transaction, TRANSACTION_ID_PATTERN, 'transaction'),
    fullHash,
    block: result.block === undefined ? null : requireMatch(result.block, TRANSACTION_ID_PATTERN, 'block'),
    height: Number.isSafeInteger(result.height) ? result.height : null,
    confirmations: Number.isSafeInteger(result.confirmations) ? result.confirmations : 0,
    senderRS: typeof result.senderRS === 'string' ? result.senderRS : null,
    recipientRS: typeof result.recipientRS === 'string' ? result.recipientRS : null,
    amountNQT: typeof result.amountNQT === 'string' ? result.amountNQT : null,
    feeNQT: typeof result.feeNQT === 'string' ? result.feeNQT : null
  }
}

export async function monitorTransaction(identifier, config, fetchImpl = fetch) {
  const byFullHash = FULL_HASH_PATTERN.test(identifier)
  if (!byFullHash && !TRANSACTION_ID_PATTERN.test(identifier)) {
    throw new TypeError('Invalid transaction identifier')
  }
  const results = await Promise.all(config.nodeUrls.map(async node => {
    try {
      const result = await requestNode(node, {
        requestType: 'getTransaction',
        [byFullHash ? 'fullHash' : 'transaction']: identifier
      }, config.timeoutMs, fetchImpl)
      return sanitizeLookup(node, result)
    } catch (error) {
      return {
        node,
        found: false,
        notFound: false,
        error: error instanceof Error ? error.message : 'Node request failed'
      }
    }
  }))
  const found = results.filter(result => result.found)
  if (found.length === 0) {
    return {
      status: results.every(result => result.notFound) ? 'not_found' : 'unavailable',
      observations: results
    }
  }
  const fingerprints = new Set(found.map(result => `${result.fullHash}:${result.block || 'pending'}`))
  if (fingerprints.size !== 1) return { status: 'inconsistent', observations: results }
  const confirmed = found.every(result => result.block && result.confirmations > 0)
  return {
    status: confirmed ? 'confirmed' : 'pending',
    transaction: found[0].transaction,
    fullHash: found[0].fullHash,
    block: confirmed ? found[0].block : null,
    confirmations: confirmed ? Math.min(...found.map(result => result.confirmations)) : 0,
    observedNodes: found.length,
    configuredNodes: results.length,
    observations: results
  }
}
