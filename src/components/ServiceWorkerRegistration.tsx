'use client'

import { useEffect } from 'react'
import { buildId } from '@/lib/build-info'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // The build id in the script URL gives each deploy its own cache name;
      // the worker deletes the previous build's cache on activate (#479).
      navigator.serviceWorker
        .register(`/sw.js?v=${encodeURIComponent(buildId())}`)
        .then((registration) => {
          console.log('SW registered:', registration.scope)
        })
        .catch((error) => {
          console.log('SW registration failed:', error)
        })
    }
  }, [])

  return null
}
