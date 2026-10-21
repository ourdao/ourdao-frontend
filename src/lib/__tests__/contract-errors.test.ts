import { describe, it, expect } from 'vitest'
import { CONTRACT_ERROR_MESSAGES, formatContractError } from '../contract-errors'
import { Errors } from '../generated/dao-bindings'

describe('CONTRACT_ERROR_MESSAGES', () => {
  it('has a message for every error code in the contract bindings', () => {
    const missing = Object.keys(Errors)
      .map(Number)
      .filter((code) => !(code in CONTRACT_ERROR_MESSAGES))
    expect(missing).toEqual([])
  })

  it('maps InvalidMetadataCid (#78) to a specific message', () => {
    expect(formatContractError('HostError: Error(Contract, [#78])')).toBe(
      CONTRACT_ERROR_MESSAGES[78],
    )
  })
})
