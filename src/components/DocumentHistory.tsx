'use client'

import { useDocumentHistory } from '@/hooks/useDAO'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FileText, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AddressLink } from '@/components/AddressLink'
import { IPFS_GATEWAY } from '@/constants'

interface DocumentHistoryProps {
  kind: 'loan' | 'treasury'
  proposalId: number
}

export function DocumentHistory({ kind, proposalId }: DocumentHistoryProps) {
  const { history, isLoading, isError } = useDocumentHistory(kind, proposalId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Document History
          </CardTitle>
          <CardDescription>Attachment history for this proposal</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading document history...</p>
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
        <CardTitle className="flex items-center gap-2 text-lg">
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
              <tr className="text-muted-foreground border-b text-left">
                <th className="pb-2 font-medium">Attached By</th>
                <th className="pb-2 font-medium">Content Hash (CID)</th>
                <th className="pb-2 font-medium">Ledger</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 text-right font-medium">View</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {history.map((item, idx) => (
                <tr key={`${item.cid}-${item.ledger}-${idx}`} className="hover:bg-muted/50">
                  <td className="py-2.5 text-xs">
                    <AddressLink address={item.attached_by} />
                  </td>
                  <td className="max-w-[200px] truncate py-2.5 font-mono text-xs" title={item.cid}>
                    {item.cid}
                  </td>
                  <td className="text-muted-foreground py-2.5 text-xs">#{item.ledger}</td>
                  <td className="text-muted-foreground py-2.5 text-xs">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="py-2.5 text-right">
                    {IPFS_GATEWAY ? (
                      <a
                        href={`${IPFS_GATEWAY}${item.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Open <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
