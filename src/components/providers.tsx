'use client'

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { ThemeProvider } from 'next-themes'
import { WalletProvider } from '@/lib/wallet'
import { QUERY_STALE_TIME_MS } from '@/constants'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              // Styled from the same semantic CSS custom properties as the
              // rest of the app (globals.css), not hardcoded hex — these
              // resolve correctly in both themes via the inherited `.dark`
              // override, with no JS-side theme check and no hydration
              // mismatch (#67).
              style: {
                background: 'var(--color-card)',
                color: 'var(--color-card-foreground)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              },
              success: {
                iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-success-foreground)' },
              },
              error: {
                iconTheme: { primary: 'var(--color-destructive)', secondary: 'var(--color-destructive-foreground)' },
              },
            }}
          />
          {children}
        </WalletProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error('Query failed', { queryKey: query.queryKey, error })
        if (query.meta?.notifyOnError) {
          toast.error('Unable to refresh this data. Please try again.')
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: true,
        retry: 0,
      },
    },
  })
}
