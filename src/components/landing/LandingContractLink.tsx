'use client'

import { getContractUrl } from '@/lib/stellar'

/* Client island: getContractUrl lives in the client-only stellar module,
   so the server-rendered landing page can't call it directly. */
export function LandingContractLink() {
  return (
    <a href={getContractUrl() ?? undefined} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm transition-colors">
      View Contract
    </a>
  )
}
