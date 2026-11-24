// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useProposalFilters,
  type FilterableProposal,
} from '@/hooks/useProposalFilters'

// The hook reads its query state from the URL via next/navigation. That is the
// framework/router boundary, not the app's data layer, so it is the only thing
// mocked here. The hook's own filter, search and sort logic runs for real
// (ADR-005: exercise real hook logic, do not mock the hook itself).

let currentParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => '/proposals',
}))

function setParams(query: Record<string, string>) {
  currentParams = new URLSearchParams(query)
}

function run<T extends FilterableProposal>(items: T[], query: Record<string, string> = {}) {
  setParams(query)
  const { result } = renderHook(() => useProposalFilters(items))
  return result.current.filteredItems
}

const ids = (list: { id: number }[]) => list.map((p) => p.id)

const proposals: FilterableProposal[] = [
  { id: 1, status: 0, purpose: 'Buy equipment', title: 'Alpha', description: 'first', borrower: 'GBORROWER1', recipient: 'GRECIP1', amount: 100n },
  { id: 2, status: 1, purpose: 'Rent space', title: 'Beta', description: 'second', borrower: 'GBORROWER2', recipient: 'GRECIP2', amount: 300n },
  { id: 3, status: 1, purpose: 'Salary', title: 'Gamma', description: 'third', borrower: 'GOTHER', recipient: 'GRECIP3', amount: 200n },
  { id: 12, status: 2, purpose: 'Marketing', title: 'Delta', description: 'twelfth', borrower: 'GZED', recipient: 'GTARGET', amount: 50n },
]

describe('useProposalFilters: status filter', () => {
  it('keeps only items whose numeric status matches', () => {
    expect(ids(run(proposals, { status: '1' }))).toEqual([3, 2])
    expect(ids(run(proposals, { status: '0' }))).toEqual([1])
    expect(ids(run(proposals, { status: '2' }))).toEqual([12])
  })

  it('returns every item when status is "all" (and when the param is absent)', () => {
    expect(ids(run(proposals, { status: 'all' }))).toEqual([12, 3, 2, 1])
    expect(ids(run(proposals))).toEqual([12, 3, 2, 1])
  })

  it('ignores a non-numeric status and does not filter by it', () => {
    expect(ids(run(proposals, { status: 'voting' }))).toEqual([12, 3, 2, 1])
    expect(ids(run(proposals, { status: 'Approved' }))).toEqual([12, 3, 2, 1])
  })
})

describe('useProposalFilters: search', () => {
  it.each([
    ['purpose', 'equipment', [1]],
    ['title', 'gamma', [3]],
    ['description', 'twelfth', [12]],
    ['borrower', 'gother', [3]],
    ['recipient', 'grecip2', [2]],
  ] as const)('matches the %s field case-insensitively', (_field, term, expected) => {
    expect(ids(run(proposals, { search: term }))).toEqual(expected)
  })

  it('matches the upper-case form of a lower-case term and vice versa', () => {
    expect(ids(run(proposals, { search: 'BUY EQUIPMENT' }))).toEqual([1])
    expect(ids(run(proposals, { search: 'rent SPACE' }))).toEqual([2])
  })

  it('matches the #id token', () => {
    expect(ids(run(proposals, { search: '#12' }))).toEqual([12])
    expect(ids(run(proposals, { search: '#2' }))).toEqual([2])
  })

  it('returns no items when nothing matches', () => {
    expect(run(proposals, { search: 'nomatch-xyz' })).toEqual([])
  })
})

describe('useProposalFilters: amount sorting above 2^53', () => {
  const TWO_53 = 2n ** 53n
  const big = [
    { id: 1, status: 0, amount: TWO_53 + 2n },
    { id: 2, status: 0, amount: TWO_53 },
    { id: 3, status: 0, amount: TWO_53 + 1n },
    { id: 4, status: 0, amount: 10n ** 20n },
    { id: 5, status: 0, amount: 1n },
  ]

  it('amount_high orders bigint amounts above 2^53 in descending order', () => {
    expect(ids(run(big, { sort: 'amount_high' }))).toEqual([4, 1, 3, 2, 5])
  })

  it('amount_low orders bigint amounts above 2^53 in ascending order', () => {
    expect(ids(run(big, { sort: 'amount_low' }))).toEqual([5, 2, 3, 1, 4])
  })

  it('distinguishes amounts that differ by 1 near 2^53 (not collapsed by Number precision)', () => {
    const near = [
      { id: 1, status: 0, amount: TWO_53 + 1n },
      { id: 2, status: 0, amount: TWO_53 },
    ]
    expect(ids(run(near, { sort: 'amount_high' }))).toEqual([1, 2])
    expect(ids(run(near, { sort: 'amount_low' }))).toEqual([2, 1])
  })
})

describe('useProposalFilters: id sorting', () => {
  const unordered = [
    { id: 7, status: 0 },
    { id: 2, status: 0 },
    { id: 10, status: 0 },
    { id: 4, status: 0 },
  ]

  it('newest sorts by id descending', () => {
    expect(ids(run(unordered, { sort: 'newest' }))).toEqual([10, 7, 4, 2])
  })

  it('oldest sorts by id ascending', () => {
    expect(ids(run(unordered, { sort: 'oldest' }))).toEqual([2, 4, 7, 10])
  })

  it('defaults to newest when no sort param is present', () => {
    expect(ids(run(unordered))).toEqual([10, 7, 4, 2])
  })
})

describe('useProposalFilters: combined and immutability', () => {
  beforeEach(() => {
    currentParams = new URLSearchParams()
  })

  it('applies status, search and sort together', () => {
    expect(ids(run(proposals, { status: '1', search: 'gother', sort: 'oldest' }))).toEqual([3])
  })

  it('does not mutate the input array', () => {
    const input = [...proposals]
    const snapshot = ids(input)
    run(input, { sort: 'oldest' })
    expect(ids(input)).toEqual(snapshot)
  })
})
