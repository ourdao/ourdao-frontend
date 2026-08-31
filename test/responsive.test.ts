import { describe, expect, it, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResponsiveCardLayout } from '@/lib/responsive'

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('useResponsiveCardLayout', () => {
  const originalInnerWidth = window.innerWidth

  afterEach(() => {
    setWidth(originalInnerWidth)
  })

  it('returns grid-cols-1 for sm breakpoint regardless of itemCount', () => {
    setWidth(500) // below sm breakpoint
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(1)).toBe('grid-cols-1')
    expect(result.current.getCardGridClass(2)).toBe('grid-cols-1')
    expect(result.current.getCardGridClass(4)).toBe('grid-cols-1')
  })

  it('returns grid-cols-1 for md breakpoint with 1 item', () => {
    setWidth(700) // md range
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(1)).toBe('grid-cols-1')
  })

  it('returns grid-cols-2 for md breakpoint with 2+ items', () => {
    setWidth(700) // md range
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(2)).toBe('grid-cols-2')
    expect(result.current.getCardGridClass(3)).toBe('grid-cols-2')
    expect(result.current.getCardGridClass(4)).toBe('grid-cols-2')
  })

  it('returns grid-cols-2 for lg breakpoint with <=2 items', () => {
    setWidth(1100) // lg range
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(1)).toBe('grid-cols-2')
    expect(result.current.getCardGridClass(2)).toBe('grid-cols-2')
  })

  it('returns grid-cols-3 for lg breakpoint with 3 items', () => {
    setWidth(1100) // lg range
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(3)).toBe('grid-cols-3')
  })

  it('returns grid-cols-4 for lg breakpoint with 4+ items', () => {
    setWidth(1100) // lg range
    const { result } = renderHook(() => useResponsiveCardLayout())
    expect(result.current.getCardGridClass(4)).toBe('grid-cols-4')
    expect(result.current.getCardGridClass(5)).toBe('grid-cols-4')
  })
})
