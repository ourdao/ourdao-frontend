import { useState, useEffect, useCallback } from 'react'
import { backend, type AuditLogEntry } from '@/lib/backend'
import toast from 'react-hot-toast'

export function useAdminAuditLog(pageSize = 10) {
  const [entries, setEntries] = useState<AuditLogEntry[]>
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [page, setPage] = useState<number>(1)

  const fetchLog = useCallback(async (pageNum: number, append = false) => {
    try {
      setLoading(true)
      setError(null)
      const data = await backend.getAdminLog(pageNum, pageSize)
      if (Array.isArray(data)) {
        setEntries(prev => append && prev ? [...prev, ...data] : data)
        setHasMore(data.length === pageSize)
      } else {
        setEntries([])
        setHasMore(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit log'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    fetchLog(1, false)
  }, [fetchLog])

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchLog(nextPage, true)
  }, [loading, hasMore, page, fetchLog])

  const refetch = useCallback(() => {
    setPage(1)
    fetchLog(1, false)
  }, [fetchLog])

  return {
    entries,
    loading,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
