// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { storeCommitSalt, loadCommitSalt } from '../utils'

const SALT_STORAGE_KEY = 'ourdao-commit-salt'

function validSalt(fill: number): number[] {
  return Array.from({ length: 32 }, () => fill)
}

describe('commit salt storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('round-trips a salt that was stored for a proposal', () => {
    const salt = new Uint8Array(32).fill(7)

    storeCommitSalt(3, salt)

    expect(loadCommitSalt(3)).toEqual(salt)
  })

  it('returns null when nothing is stored', () => {
    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null for a non-JSON stored value', () => {
    localStorage.setItem(SALT_STORAGE_KEY, '{not json')

    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null when the stored value is not a map of arrays', () => {
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify(['not', 'a', 'map']))

    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null for a wrong-length salt', () => {
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify({ 1: validSalt(1).slice(0, 31) }))

    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null for a salt holding non-numeric values', () => {
    const bad = validSalt(1).map((n, i) => (i === 0 ? 'x' : n))
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify({ 1: bad }))

    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null for a salt with a byte outside 0..255', () => {
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify({ 1: validSalt(256) }))

    expect(loadCommitSalt(1)).toBeNull()
  })

  it('returns null for a null entry or a nested array', () => {
    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify({ 1: null }))
    expect(loadCommitSalt(1)).toBeNull()

    localStorage.setItem(SALT_STORAGE_KEY, JSON.stringify({ 1: [validSalt(1)] }))
    expect(loadCommitSalt(1)).toBeNull()
  })

  it('discards the whole map when any entry is malformed', () => {
    localStorage.setItem(
      SALT_STORAGE_KEY,
      JSON.stringify({ 1: validSalt(1), 2: validSalt(2).slice(0, 5) })
    )

    expect(loadCommitSalt(1)).toBeNull()
  })
})
