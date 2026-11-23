// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { ThemeToggle } from '@/components/ThemeToggle'

const setTheme = vi.hoisted(() => vi.fn())
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark', setTheme }),
}))

it('waits for hydration before rendering a theme-dependent control', () => {
  expect(renderToString(<ThemeToggle />)).not.toContain('<button')
  render(<ThemeToggle />)
  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(setTheme).toHaveBeenCalledWith('light')
})
