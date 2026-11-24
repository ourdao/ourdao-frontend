'use client'

import { useQuery } from '@tanstack/react-query'
import { daoRead } from '@/lib/dao-client'
import { isContractConfigured } from '@/lib/stellar'
import { queryKeys } from '@/lib/query-keys'

export interface ContractInfo {
  version: string
  admin: string
  treasury: string
  token: string
  createdAt: number
}

export function ContractSummary() {
  const {
    data: contractInfo,
    isLoading,
    isError,
  } = useQuery({
    queryKey: queryKeys.contractInfo(),
    enabled: isContractConfigured(),
    queryFn: async () => {
      const info = await daoRead.getContractInfo()
      return info || null
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  if (isError) {
    return <div className="text-red-500">Failed to load contract information</div>
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading contract information...</div>
  }

  if (!contractInfo) {
    return <div className="text-gray-500">No contract information available</div>
  }

  return (
    <div className="border rounded-lg p-6 bg-white space-y-4">
      <h2 className="text-lg font-semibold">Contract Summary</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-gray-600">Contract Version</div>
          <div className="text-lg font-semibold font-mono">
            {contractInfo.version}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">Admin Address</div>
          <div className="text-sm font-mono truncate">{contractInfo.admin}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600">Treasury Address</div>
          <div className="text-sm font-mono truncate">
            {contractInfo.treasury}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">Token Address</div>
          <div className="text-sm font-mono truncate">{contractInfo.token}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600">Created At</div>
          <div className="text-lg font-semibold">
            {new Date(contractInfo.createdAt * 1000).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

export function useContractVersion() {
  const { data: contractInfo, isLoading } = useQuery({
    queryKey: queryKeys.contractInfo(),
    enabled: isContractConfigured(),
    queryFn: async () => {
      const info = await daoRead.getContractInfo()
      return info || null
    },
    retry: 2,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  return {
    version: contractInfo?.version || null,
    isLoading,
    matches: (expectedVersion: string) =>
      contractInfo?.version === expectedVersion,
  }
}
