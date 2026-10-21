import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Treasury',
  description: 'Treasury balance, staking (stake/unstake for voting-weight boost), claimable yield.',
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
  // The page reads its filters via useSearchParams(), which must sit under a
  // Suspense boundary or static prerendering of this route fails.
  return <Suspense>{children}</Suspense>
}
