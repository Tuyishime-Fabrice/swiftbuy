export const ErrorKind = {
  AUTH: 'auth',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  NETWORK: 'network',
  RULE: 'rule',
  SERVER: 'server',
}

const FALLBACK = {
  [ErrorKind.AUTH]: 'Please sign in to continue.',
  [ErrorKind.PERMISSION]: "You don't have permission to do that.",
  [ErrorKind.VALIDATION]: 'Please check the details you entered.',
  [ErrorKind.NOT_FOUND]: "We couldn't find that.",
  [ErrorKind.CONFLICT]: 'That has already been done.',
  [ErrorKind.NETWORK]: "We couldn't reach SHOP MUMU. Check your connection and try again.",
  [ErrorKind.RULE]: "That isn't possible right now.",
  [ErrorKind.SERVER]: 'Something went wrong on our side. Please try again.',
}

function isAuthoredMessage(code) {
  return ['P0001', 'P0002', '22023', '42501'].includes(code)
}

export function classifyError(error) {
  if (!error) return null

  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return { kind: ErrorKind.NETWORK, message: FALLBACK[ErrorKind.NETWORK] }
  }

  const code = error.code ?? error.status?.toString()
  const raw = typeof error.message === 'string' ? error.message : ''

  let kind = ErrorKind.SERVER
  if (code === '42501' || error.status === 403) kind = ErrorKind.PERMISSION
  else if (code === 'P0002' || error.status === 404) kind = ErrorKind.NOT_FOUND
  else if (code === '22023' || code === '23514' || error.status === 400) kind = ErrorKind.VALIDATION
  else if (code === '23505') kind = ErrorKind.CONFLICT
  else if (code === 'P0001') kind = ErrorKind.RULE
  else if (error.status === 401) kind = ErrorKind.AUTH

  const message = isAuthoredMessage(code) && raw ? raw : FALLBACK[kind]
  return { kind, message, code, raw }
}

export function handleError(error, context) {
  const classified = classifyError(error)
  if (!classified) return null
  if (import.meta.env.DEV) {
    console.error(`[shop-mumu] ${context}:`, classified.code ?? '', classified.raw ?? error)
  }
  return classified
}

export function assertOk(error, context) {
  if (!error) return
  const classified = handleError(error, context)
  const err = new Error(classified.message)
  err.kind = classified.kind
  err.code = classified.code
  throw err
}
