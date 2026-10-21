import { Suspense } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  // See src/app/(app)/loans/layout.tsx for why `template` is repeated here rather
  // than relying on the root layout's — Next only applies it one level down.
  title: { default: 'Governance', template: '%s · OurDAO' },
  description: 'Browse and vote on both loan and treasury proposals in one place.',
}

export default function GovernanceLayout({ children }: { children: React.ReactNode }) {
  // The page reads its filters via useSearchParams(), which must sit under a
  // Suspense boundary or static prerendering of this route fails.
  return <Suspense>{children}</Suspense>
}
