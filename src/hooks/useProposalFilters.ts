'use client'

import { useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export type ProposalSortOrder = 'newest' | 'oldest' | 'amount_high' | 'amount_low'

export interface ProposalFilterState {
  search: string
  status: string
  sort: ProposalSortOrder
}

export interface FilterableProposal {
  id: number
  status: number
  amount?: bigint
  borrower?: string
  recipient?: string
  purpose?: string
  title?: string
  description?: string
}

/**
 * Reusable hook for proposal filtering, text search, and sorting.
 * Query state is persisted to the URL search parameters so state survives reloads.
 */
export function useProposalFilters<T extends FilterableProposal>(
  items: T[],
  defaultStatus = 'all'
) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const status = searchParams.get('status') ?? defaultStatus
  const search = searchParams.get('search') ?? ''
  const sort = (searchParams.get('sort') as ProposalSortOrder) ?? 'newest'

  const updateFilters = useCallback(
    (updates: Partial<ProposalFilterState>) => {
      const params = new URLSearchParams(searchParams.toString())
      if (updates.status !== undefined) {
        if (updates.status === 'all') params.delete('status')
        else params.set('status', updates.status)
      }
      if (updates.search !== undefined) {
        if (!updates.search.trim()) params.delete('search')
        else params.set('search', updates.search.trim())
      }
      if (updates.sort !== undefined) {
        if (updates.sort === 'newest') params.delete('sort')
        else params.set('sort', updates.sort)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  const filteredItems = useMemo(() => {
    let result = [...items]

    if (status !== 'all') {
      const statusNum = Number(status)
      if (!isNaN(statusNum)) {
        result = result.filter((item) => item.status === statusNum)
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((item) => {
        const text = `${item.purpose ?? ''} ${item.title ?? ''} ${item.description ?? ''} ${item.borrower ?? ''} ${item.recipient ?? ''} #${item.id}`.toLowerCase()
        return text.includes(q)
      })
    }

    result.sort((a, b) => {
      if (sort === 'newest') return b.id - a.id
      if (sort === 'oldest') return a.id - b.id
      if (sort === 'amount_high') return Number((b.amount ?? BigInt(0)) - (a.amount ?? BigInt(0)))
      if (sort === 'amount_low') return Number((a.amount ?? BigInt(0)) - (b.amount ?? BigInt(0)))
      return 0
    })

    return result
  }, [items, status, search, sort])

  return {
    filters: { search, status, sort },
    setSearch: (s: string) => updateFilters({ search: s }),
    setStatus: (st: string) => updateFilters({ status: st }),
    setSort: (so: ProposalSortOrder) => updateFilters({ sort: so }),
    filteredItems,
  }
}
