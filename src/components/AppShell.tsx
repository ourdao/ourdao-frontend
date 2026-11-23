'use client'

/**
 * Shared application shell: a sticky top bar plus a persistent sidebar on
 * desktop (a slide-over drawer on mobile). Renders the primary navigation from
 * a single source of truth, highlights the active route, and surfaces a banner
 * when no contract is configured. Rendered once by (app)/layout.tsx, so it
 * persists across navigation instead of remounting per page. A page's own
 * title/subtitle/actions header is <PageHeader>, rendered by the page itself.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Banknote,
  Users,
  UsersRound,
  Landmark,
  ShieldCheck,
  Settings,
  Menu,
  TriangleAlert,
  LogOut,
} from 'lucide-react'
import { ConnectButton } from '@/components/ConnectButton'
import { NetworkBadge } from '@/components/NetworkBadge'
import NotificationCenter from '@/components/NotificationCenter'
import { OrbitMark } from '@/components/OrbitMark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useUserData, useDAOStats, useContractVersion } from '@/hooks/useDAO'
import { useStreamStatus } from '@/hooks/useLiveEvents'
import { buildLabel, pinnedContractVersion } from '@/lib/build-info'
import { isBackendConfigured } from '@/lib/backend'
import { contractIdStatus } from '@/lib/stellar'
import { cn } from '@/lib/utils'
import { MAIN_CONTENT_ID } from '@/lib/a11y'

interface NavItem {
  name: string
  href: string
  icon: typeof Home
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Loans', href: '/loans', icon: Banknote },
  { name: 'Governance', href: '/governance', icon: Users },
  { name: 'Members', href: '/members', icon: UsersRound },
  { name: 'Treasury', href: '/treasury', icon: Landmark },
  { name: 'Privacy', href: '/privacy', icon: ShieldCheck },
  { name: 'Exit', href: '/exit', icon: LogOut },
]

const ADMIN_ITEM: NavItem = { name: 'Admin', href: '/admin', icon: Settings }

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <OrbitMark className="h-9 w-9" />
      <span className="text-lg font-semibold tracking-tight text-foreground">
        OurDAO
      </span>
    </Link>
  )
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { isAdmin } = useUserData()
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'h-5 w-5 shrink-0',
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-muted-foreground group-hover:text-foreground'
              )}
            />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}

// Names the running build so a bug report can be matched to CHANGELOG.md (#250).
// Shows the deployed contract version alongside the frontend build (#645).
function BuildLabel() {
  const { version } = useContractVersion()
  return (
    <div className="px-6 pt-4 space-y-1">
      <p className="text-xs text-muted-foreground">{buildLabel()}</p>
      {version && (
        <p className="text-xs text-muted-foreground">
          Contract: <span className="font-mono">{version}</span>
        </p>
      )}
    </div>
  )
}

const STREAM_STATUS_TEXT = {
  connected: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
}

function LiveConnectionStatus() {
  const status = useStreamStatus()
  return (
    <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
      <span className="sr-only">Live updates: </span>
      {STREAM_STATUS_TEXT[status]}
    </span>
  )
}

interface AppShellProps {
  children: ReactNode
}

/**
 * Dismissible warning shown when the deployed contract's version (read via
 * `get_version()`) does not match the version pinned in
 * `contract/interface.json` (#645). When they match, nothing is shown.
 * The deployed version is always shown in the build label regardless.
 */
function ContractVersionBanner() {
  const { version, isLoading } = useContractVersion()
  const [dismissed, setDismissed] = useState(false)
  const pinned = pinnedContractVersion()

  if (isLoading || dismissed || !version || !pinned || version === pinned) return null

  return (
    <div
      data-testid="contract-version-mismatch-banner"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:px-6"
    >
      <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>
        Contract version mismatch: the deployment reports <strong className="font-mono">{version}</strong> but
        the frontend was built against <strong className="font-mono">{pinned}</strong>. Some features may not
        work as expected.
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-auto shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        aria-label="Dismiss version mismatch warning"
      >
        ✕
      </button>
    </div>
  )
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const stats = useDAOStats()
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)
  const previousPathname = useRef(pathname)

  // Client-side navigation swaps the page without a document load, so the
  // browser leaves focus on the (now stale) link that was clicked and a
  // screen-reader user is never told the page changed. On a real route change
  // move focus to the new page's heading (or <main> if it has none). Next's
  // built-in route announcer reads the new document title. Skipped on first
  // render so the initial load keeps the browser's native focus behaviour.
  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    const main = mainRef.current
    if (!main) return
    const heading = main.querySelector<HTMLElement>('h1')
    const target = heading ?? main
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    // Wraps the whole shell (not just the drawer) so SheetTrigger — deep in
    // the header — and SheetContent — deep in the mobile-drawer section —
    // both sit under the same Radix Dialog.Root context despite being far apart
    // in the JSX. Using SheetTrigger (rather than a plain onClick)
    // is what lets Radix track and restore focus to this exact button when
    // the drawer closes (#68).
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
    <div className="min-h-screen bg-background">
      {/* The skip link is rendered once, globally, by Providers (SkipLink). */}
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1 sm:flex-nowrap sm:px-6">
          <SheetTrigger asChild>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
          </SheetTrigger>
          <div className="flex flex-col">
            <BrandMark />
            <LiveConnectionStatus />
          </div>
          <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:gap-3">
            <NetworkBadge />
            <ThemeToggle />
            <NotificationCenter />
            <ConnectButton />
          </div>
        </div>
      </header>

      {contractIdStatus() === 'unconfigured' && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:px-6">
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>
            No contract configured — set{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/40">
              NEXT_PUBLIC_CONTRACT_ID
            </code>{' '}
            to enable live data. The app is running in preview mode.
          </span>
        </div>
      )}

      {contractIdStatus() === 'invalid' && (
        <div
          data-testid="invalid-contract-id-banner"
          className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 sm:px-6"
        >
          <TriangleAlert className="h-5 w-5 shrink-0" />
          <span>
            Invalid{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs dark:bg-red-900/40">
              NEXT_PUBLIC_CONTRACT_ID
            </code>
            {' '}— the value is set but is not a valid Soroban contract address. All reads
            and writes will fail. Check your{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs dark:bg-red-900/40">
              .env
            </code>{' '}
            file and redeploy.
          </span>
        </div>
      )}

      {stats.isPaused && (
        <div data-testid="dao-paused-banner" role="status" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 sm:px-6">
          <TriangleAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <span>
            The DAO is currently <strong>paused</strong>. All actions are blocked except loan repayments until an admin unpauses it.
          </span>
        </div>
      )}

      {stats.indexerStale && (
        <div data-testid="indexer-stale-banner" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:px-6">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Indexer data is stale{stats.secondsSinceUpdate != null ? ` (last updated ${stats.secondsSinceUpdate}s ago)` : ''}{stats.lastIndexedLedger != null ? ` · last ledger #${stats.lastIndexedLedger}` : ''}. Displayed off-chain stats and history may be delayed.
          </span>
        </div>
      )}
      {stats.indexerError && isBackendConfigured() && !stats.indexerStale && (
        <div data-testid="backend-unreachable-banner" className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 sm:px-6">
          <TriangleAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            Off-chain backend is unreachable. Loan history, proposals, and live aggregates may be unavailable.
          </span>
        </div>
      )}

      <ContractVersionBanner />

      <div className="mx-auto flex w-full max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-border bg-card py-4 lg:flex">
          <NavLinks />
          <BuildLabel />
        </aside>

        {/* Mobile drawer — built on the vendored Radix-based Sheet primitive
            instead of a hand-rolled div, so Escape-to-close, focus trapping
            + restoration to the hamburger button, role="dialog"/aria-modal,
            and body scroll lock all come from Radix rather than being
            reimplemented by hand (#68). */}
        <SheetContent
          side="left"
          className="w-64 gap-0 bg-card p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="flex h-full flex-col py-4">
            <div className="mb-2 px-4">
              <BrandMark />
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <BuildLabel />
          </div>
        </SheetContent>

        {/* Main content */}
        <main
          id={MAIN_CONTENT_ID}
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 [&_h1:focus]:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
    </Sheet>
  )
}
