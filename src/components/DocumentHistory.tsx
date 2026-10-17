'use client'

import { useDocumentHistory } from '@/hooks/useDAO'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FileText, ExternalLink, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'

interface DocumentHistoryProps {
  kind: 'loan' | 'treasury'
  proposalId: number
}

export function DocumentHistory({ kind, proposalId }: DocumentHistoryProps) {
  const { history, isLoading, isError } = useDocumentHistory(kind, proposalId)
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document History
          </CardTitle>
          <CardDescription>Attachment history for this proposal</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading document history...</p>
        </CardContent>
      </Card>
    )
  }

  if (isError || history.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Attachment History
        </CardTitle>
        <CardDescription>
          Audit trail of off-chain documents anchored to this proposal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Attached By</th>
                <th className="pb-2 font-medium">Content Hash (CID)</th>
                <th className="pb-2 font-medium">Ledger</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((item, idx) => (
                <tr key={`${item.cid}-${item.ledger}-${idx}`} className="hover:bg-muted/50">
                  <td className="py-2.5 text-xs">
                    <AddressLink address={item.attached_by} />
                  </td>
                  <td className="py-2.5 font-mono text-xs truncate max-w-[200px]" title={item.cid}>
                    {item.cid}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    #{item.ledger}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="py-2.5 text-right">
                    <a
                      href={`${gateway}${item.cid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Open <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
