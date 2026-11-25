'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConnectButton } from '@/components/ConnectButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import NotificationCenter from '@/components/NotificationCenter'
import { useUserData } from '@/hooks/useDAO'

export function LandingHeaderActions() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const userData = useUserData()

  return (
    <>
      <div className="flex items-center space-x-4">
        {userData.isConnected && userData.isMember && (
          <>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <NotificationCenter />
          </>
        )}
        <ThemeToggle />
        <ConnectButton />

        {/* Mobile menu button */}
        <button
          className="text-muted-foreground hover:text-foreground rounded-md p-2 md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="bg-background border-border absolute top-16 right-0 left-0 border-b md:hidden">
          <div className="space-y-1 px-4 pt-2 pb-3">
            <Link
              href="/loans"
              className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Loans
            </Link>
            <Link
              href="/governance"
              className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Governance
            </Link>
            <Link
              href="/treasury"
              className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Treasury
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground block px-3 py-2 text-base font-medium"
              onClick={() => setMobileMenuOpen(false)}
            >
              Privacy
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
