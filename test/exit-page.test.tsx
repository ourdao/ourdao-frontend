// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from './test-utils'
import ExitPage from '@/app/(app)/exit/page'

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockExitDao = vi.fn()
let mockIsSuccess = false
let mockUserData = {
  address: 'GALICE',
  isConnected: true,
  isLoading: false,
  isError: false,
  isMember: true,
  isAdmin: false,
  hasActiveLoan: false,
  member: {
    address: 'GALICE',
    status: 1,
    shareBalance: BigInt(100_0000000),
    joinedAt: 1_700_000_000,
    totalContributed: BigInt(100_0000000),
  },
  pendingYield: BigInt(0),
  refetch: vi.fn(),
}

vi.mock('next/navigation', () => ({
  usePathname: () => '/exit',
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))

vi.mock('@/hooks/useDAO', () => ({
  useUserData: () => mockUserData,
  useStake: () => BigInt(0),
  useExitDao: () => ({
    exitDao: mockExitDao,
    isPending: false,
    isSuccess: mockIsSuccess,
  }),
  useDAOStats: () => ({ isPaused: false }),
}))

describe('ExitPage (#565)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSuccess = false
    mockUserData = {
      ...mockUserData,
      isConnected: true,
      isLoading: false,
      isError: false,
      isMember: true,
      hasActiveLoan: false,
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('redirects a visitor who was never a member to /register', async () => {
    mockUserData = { ...mockUserData, isMember: false, member: undefined as never }
    renderWithProviders(<ExitPage />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/register')
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByText('Not a Member')).toBeTruthy()
  })

  it('keeps the "Successfully exited the DAO" card visible when isMember flips to false after exitDao() resolves', async () => {
    mockExitDao.mockImplementation(async () => {
      mockIsSuccess = true
      mockUserData = { ...mockUserData, isMember: false, member: undefined as never }
    })

    const { rerender } = renderWithProviders(<ExitPage />)

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    const submitButton = screen.getByRole('button', { name: /exit dao/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockExitDao).toHaveBeenCalledTimes(1)
    })

    rerender(<ExitPage />)

    expect(screen.getByText('Successfully exited the DAO')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalledWith('/register')
    expect(mockPush).not.toHaveBeenCalledWith('/register')
  })
})
