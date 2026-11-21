// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRequireMember, useRedirectIfMember } from '@/hooks/useRequireMember'
import type { UserData } from '@/types/dao'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

function makeUserData(overrides: Partial<UserData> = {}): UserData {
  return {
    address: 'GALICE',
    isConnected: true,
    isLoading: false,
    isError: false,
    isMember: true,
    isAdmin: false,
    member: undefined,
    votingWeight: 0,
    pendingYield: BigInt(0),
    hasActiveLoan: false,
    loans: [],
    refetch: vi.fn(),
    ...overrides,
  }
}

describe('useRequireMember (#566)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not redirect while isLoading is true', () => {
    renderHook(() =>
      useRequireMember({
        userData: makeUserData({
          isLoading: true,
          isConnected: false,
          isMember: false,
        }),
      }),
    )

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('uses router.replace (not push) when wallet is disconnected', () => {
    renderHook(() =>
      useRequireMember({
        userData: makeUserData({
          isConnected: false,
          isMember: false,
        }),
      }),
    )

    expect(mockReplace).toHaveBeenCalledWith('/')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('uses router.replace (not push) when connected user is not a member', () => {
    renderHook(() =>
      useRequireMember({
        userData: makeUserData({
          isConnected: true,
          isMember: false,
        }),
      }),
    )

    expect(mockReplace).toHaveBeenCalledWith('/register')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not redirect an active member', () => {
    renderHook(() =>
      useRequireMember({
        userData: makeUserData({
          isConnected: true,
          isMember: true,
        }),
      }),
    )

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('useRedirectIfMember (#566)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not redirect while isLoading is true', () => {
    renderHook(() =>
      useRedirectIfMember(
        '/dashboard',
        makeUserData({
          isLoading: true,
          isConnected: true,
          isMember: true,
        }),
      ),
    )

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('uses router.replace (not push) when connected user is already a member', () => {
    renderHook(() =>
      useRedirectIfMember(
        '/dashboard',
        makeUserData({
          isConnected: true,
          isMember: true,
        }),
      ),
    )

    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not redirect when connected user is not a member', () => {
    renderHook(() =>
      useRedirectIfMember(
        '/dashboard',
        makeUserData({
          isConnected: true,
          isMember: false,
        }),
      ),
    )

    expect(mockReplace).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
