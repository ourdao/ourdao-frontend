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
          <div className={cn('rounded-xl p-3 shrink-0', tint)}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <div className="truncate text-xl font-bold text-foreground">
            {value}
          </div>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
