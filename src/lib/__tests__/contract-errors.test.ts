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
      CONTRACT_ERROR_MESSAGES[78]
    )
  })
})

describe('delegation error codes', () => {
  // NotMember (12), MemberNotActive (20) and InvalidDelegation (79) are the
  // codes delegate_vote can return.
  it.each([
    [12, 'NotMember'],
    [20, 'MemberNotActive'],
    [79, 'InvalidDelegation'],
  ])('gives %i (%s) a specific message', (code) => {
    expect(CONTRACT_ERROR_MESSAGES[code]).toBeDefined()
    expect(formatContractError(`HostError: Error(Contract, [#${code}])`)).toBe(CONTRACT_ERROR_MESSAGES[code])
  })
})
