// @vitest-environment node
//
// Pure-logic suite for proposal pagination. `fetchProposalPage` takes its
// contract read as an injected `fetchOne` callback, so the boundary is that
// callback: it is a plain stub here, not a mock of a hook or of dao-client.
// The module has no imports, so nothing else needs stubbing.
import { describe, expect, it } from 'vitest'
import {
  FETCH_CONCURRENCY,
  PROPOSAL_PAGE_SIZE,
  fetchProposalPage,
} from '@/hooks/dao/enumeration'

type Raw = Record<string, unknown>

// Stub contract read: every id 0..count-1 exists and echoes its id back.
const present = (id: number): Promise<Raw | null> => Promise.resolve({ id })
const map = (raw: Raw) => raw.id as number

describe('fetchProposalPage pagination', () => {
  it('walks backwards from count - 1 and returns nextOffset null at id 0', async () => {
    const fetched: number[] = []
    const fetchOne = (id: number) => {
      fetched.push(id)
      return present(id)
    }

    // count 5, page size 2: ids 4,3 then 2,1 then 0.
    const first = await fetchProposalPage(5, 0, fetchOne, map, 2)
    expect(first.items).toEqual([4, 3])
    expect(first.nextOffset).toBe(2)

    const second = await fetchProposalPage(5, first.nextOffset!, fetchOne, map, 2)
    expect(second.items).toEqual([2, 1])
    expect(second.nextOffset).toBe(4)

    const third = await fetchProposalPage(5, second.nextOffset!, fetchOne, map, 2)
    expect(third.items).toEqual([0])
    expect(third.nextOffset).toBeNull()

    expect(fetched).toEqual([4, 3, 2, 1, 0])
  })

  it('returns nextOffset null when the page ends exactly on id 0', async () => {
    // count 4, page size 2: ids 3,2 then 1,0 - the second page reaches id 0.
    const page1 = await fetchProposalPage(4, 0, present, map, 2)
    expect(page1.nextOffset).toBe(2)

    const page2 = await fetchProposalPage(4, 2, present, map, 2)
    expect(page2.items).toEqual([1, 0])
    expect(page2.nextOffset).toBeNull()
  })

  it('uses PROPOSAL_PAGE_SIZE by default', async () => {
    const count = PROPOSAL_PAGE_SIZE + 5
    const page = await fetchProposalPage(count, 0, present, map)
    expect(page.items).toHaveLength(PROPOSAL_PAGE_SIZE)
    expect(page.items[0]).toBe(count - 1)
    expect(page.nextOffset).toBe(PROPOSAL_PAGE_SIZE)
  })

  it('a rejected fetch sets hasErrors and keeps the other rows', async () => {
    const fetchOne = (id: number) =>
      id === 2 ? Promise.reject(new Error('rpc flake')) : present(id)

    const page = await fetchProposalPage(5, 0, fetchOne, map, 5)

    expect(page.hasErrors).toBe(true)
    expect(page.items).toEqual([4, 3, 1, 0])
    // A failed row does not end pagination: the walk still reaches id 0.
    expect(page.nextOffset).toBeNull()
  })

  it('a null read drops the row without setting hasErrors', async () => {
    const fetchOne = (id: number) => (id === 3 ? Promise.resolve(null) : present(id))

    const page = await fetchProposalPage(5, 0, fetchOne, map, 5)

    expect(page.hasErrors).toBe(false)
    expect(page.items).toEqual([4, 2, 1, 0])
  })

  it('runs at most FETCH_CONCURRENCY fetches at once', async () => {
    let inFlight = 0
    let maxInFlight = 0
    let calls = 0
    const fetchOne = async (id: number) => {
      calls++
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      // Yield to the event loop so overlapping workers would be observable.
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight--
      return { id }
    }

    const page = await fetchProposalPage(40, 0, fetchOne, map, 20)

    expect(calls).toBe(20)
    expect(page.items).toHaveLength(20)
    expect(maxInFlight).toBe(FETCH_CONCURRENCY)
  })

  it('an offset past the end returns an empty page', async () => {
    const fetchOne = (id: number) => {
      throw new Error(`should not fetch id ${id}`)
    }

    // count 3 has ids 0..2; offset 3 is already past the oldest id.
    const past = await fetchProposalPage(3, 3, fetchOne, map, 2)
    expect(past).toEqual({ items: [], hasErrors: false, nextOffset: null })

    // Far past the end behaves the same way.
    const farPast = await fetchProposalPage(3, 100, fetchOne, map, 2)
    expect(farPast).toEqual({ items: [], hasErrors: false, nextOffset: null })
  })

  it('an empty collection (count 0) returns an empty page', async () => {
    const page = await fetchProposalPage(0, 0, present, map, 2)
    expect(page).toEqual({ items: [], hasErrors: false, nextOffset: null })
  })
})
