'use client'

import { getContractUrl } from '@/lib/stellar'

/* Client island: getContractUrl lives in the client-only stellar module,
   so the server-rendered landing page can't call it directly. */
export function LandingContractLink() {
  return (
    <a
      href={getContractUrl() ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-gray-400 transition-colors hover:text-white"
    >
      View Contract
    </a>
  )
}
