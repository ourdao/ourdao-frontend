import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface StatCardProps {
  label: string
  value?: string | number | React.ReactNode
  sub?: string | React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  tint?: string
  loading?: boolean
  className?: string
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tint,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton className={className} />
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div className={cn('shrink-0 rounded-xl p-3', tint)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <div className="text-foreground truncate text-xl font-bold">{value}</div>
          {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
