'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    const isSecure =
      location.protocol === 'https:' || location.hostname === 'localhost'
    const isProduction =
      process.env.NODE_ENV === 'production' || location.hostname === 'localhost'

    if ('serviceWorker' in navigator && isSecure && isProduction) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silently ignore registration failures
      })
    }
  }, [])

  return null
}
