import { useState, useEffect, useCallback } from 'react'

export function useAsyncData(fetcher, { enabled = true } = {}) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'ready', data: null, error: null })
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined

    let cancelled = false
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data, error: null })
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: error.message ?? 'Something went wrong' })
        }
      })

    return () => { cancelled = true }
  }, [fetcher, token, enabled])

  const reload = useCallback(() => setToken((t) => t + 1), [])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    setToken((t) => t + 1)
  }, [])

  const setData = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === 'function' ? updater(current.data) : updater,
    }))
  }, [])

  return { ...state, reload, retry, setData }
}
