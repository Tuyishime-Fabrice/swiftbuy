import { useState, useEffect, useCallback } from 'react'

/**
 * Loads data for a page, once, with the details that are easy to get wrong.
 *
 * Every screen in SwiftBuy fetches on mount and refetches after a mutation, and
 * doing that by hand in each one repeats the same three mistakes: a response
 * arriving after the component has unmounted, a slow first request overwriting
 * a faster second one, and an error that only ever reaches the console.
 *
 * The fetcher is a plain async function that returns data or throws — it does
 * no state updating of its own, which is also what keeps the effect free of
 * synchronous setState and its cascading renders.
 *
 * @param fetcher  a useCallback'd async function returning the page's data
 * @returns {{status, data, error, reload, retry, setData}}
 *   status  'loading' | 'ready' | 'error'
 *   reload  refetch quietly, keeping the current content on screen
 *   retry   refetch and show the loading state again (for an error screen)
 *   setData apply an optimistic local change without a round trip
 */
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

    // A response that arrives after this effect is torn down — because the
    // component unmounted, or because the inputs changed and a newer request
    // is already in flight — is discarded rather than applied out of order.
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
