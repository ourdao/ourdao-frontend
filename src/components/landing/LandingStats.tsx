'use client'

import { useDaoSummary } from '@/hooks/dao/reads'
import { useToken } from '@/hooks/useToken'
import { useDAOEvents } from '@/hooks/useDAO'
import { Users, Shield, BarChart3, CreditCard } from 'lucide-react'

// #643: feeds all landing stats from a single getDaoSummary read.
// Falls back to null/zero values when the read fails so the section
// always renders rather than disappearing silently.
export function LandingStats() {
  const { summary, isError } = useDaoSummary()
  const token = useToken()
  useDAOEvents()

  const totalMembers = summary?.totalMembers ?? 0
  const activeMembers = summary?.activeMembers ?? 0
  const treasuryBalance = summary?.treasuryBalance ?? BigInt(0)
  const totalLoans = summary?.totalLoans ?? 0

  if (!summary && !isError) {
    return null
  }

  return (
    <section className="bg-background border-border border-b py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-foreground mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Our Impact in Numbers
          </h2>
          <p className="text-muted-foreground mx-auto text-lg">
            Driving decentralized finance forward through community-powered lending.
          </p>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center">
            <div className="bg-primary-50 dark:bg-primary-950/50 mb-2 flex h-16 w-16 items-center justify-center rounded-full">
              <Users
                className="text-primary-600 dark:text-primary-400 h-8 w-8"
                aria-hidden="true"
              />
            </div>
            <dt className="text-primary-600 dark:text-primary-400 text-4xl font-bold">
              {stats.totalMembers}
            </dt>
            <dd className="text-muted-foreground mt-2 text-base font-medium">Total Members</dd>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/50">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
            </div>
            <dt className="text-4xl font-bold text-green-600 dark:text-green-400">
              {stats.activeMembers}
            </dt>
            <dd className="text-muted-foreground mt-2 text-base font-medium">Active Members</dd>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50">
              <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <dt className="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {token.format(stats.treasuryBalance)}
            </dt>
            <dd className="text-muted-foreground mt-2 text-base font-medium">Treasury Balance</dd>
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-950/50">
              <CreditCard
                className="h-8 w-8 text-orange-600 dark:text-orange-400"
                aria-hidden="true"
              />
            </div>
            <dt className="text-4xl font-bold text-orange-600 dark:text-orange-400">
              {stats.totalLoans}
            </dt>
            <dd className="text-muted-foreground mt-2 text-base font-medium">Loans Funded</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
