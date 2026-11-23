import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Users, FileText, TrendingUp, Check, Globe, Zap, Lock } from 'lucide-react'
import { OrbitMark } from '@/components/OrbitMark'
import { MAIN_CONTENT_ID } from '@/lib/a11y'
import { LandingHeaderActions } from '@/components/landing/LandingHeaderActions'
import { LandingHeroCTA } from '@/components/landing/LandingHeroCTA'
import { LandingStats } from '@/components/landing/LandingStats'
import { LandingBottomCTA } from '@/components/landing/LandingBottomCTA'
import { LandingContractLink } from '@/components/landing/LandingContractLink'

// lucide-react dropped brand/logo icons (including Github) in v1 — inlined here instead.
function GithubMark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.089-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.469-2.38 1.236-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

const features = [
  {
    name: 'Privacy-First Lending',
    description:
      'Confidential loans with zero-knowledge proofs and encrypted voting to protect member privacy.',
    icon: Lock,
    gradient: 'from-purple-500 to-indigo-500',
  },
  {
    name: 'Automated P2P Loans',
    description:
      'Smart contract-based lending with automatic approval, disbursement, and interest calculation.',
    icon: Zap,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Democratic Governance',
    description:
      'Member-driven decision making with ENS-weighted voting and transparent proposal system.',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Document Storage',
    description:
      'Decentralized IPFS storage for loan agreements and KYC documentation with encryption.',
    icon: FileText,
    gradient: 'from-orange-500 to-red-500',
  },
  {
    name: 'Yield Generation',
    description: 'Treasury optimization through staking with automatic yield distribution.',
    icon: TrendingUp,
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    name: 'Real-time Updates',
    description:
      'Live notifications and activity feeds keeping you informed of all DAO activities.',
    icon: Globe,
    gradient: 'from-violet-500 to-purple-500',
  },
]

const benefits = [
  'Transparent and Decentralized',
  'Privacy-Preserving Technology',
  'Automated Smart Contracts',
  'Community Governance',
  'Yield-Generating Treasury',
  'Real-time Notifications',
]

export default function Home() {
  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <header className="bg-background/90 border-border sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3">
              <OrbitMark className="h-11 w-11" />
              <Link
                href="/"
                className="text-foreground hover:text-muted-foreground text-xl font-bold transition-colors"
              >
                OurDAO
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden items-center space-x-8 md:flex">
              <Link
                href="/loans"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Loans
              </Link>
              <Link
                href="/governance"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Governance
              </Link>
              <Link
                href="/treasury"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Treasury
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Privacy
              </Link>
            </nav>

            <LandingHeaderActions />
          </div>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="focus:outline-none">
        {/* Hero Section */}
        <section className="dark:from-background dark:to-background relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:via-indigo-950/40">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-8 flex justify-center">
                <OrbitMark className="h-24 w-24 sm:h-28 sm:w-28" />
              </div>

              <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
                Next Generation DeFi Lending
              </Badge>

              <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                The Future of{' '}
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Decentralized Lending
                </span>
              </h1>

              <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
                Join the most advanced peer-to-peer lending DAO with privacy features, automated
                governance, and yield generation through staking.
              </p>

              <LandingHeroCTA />
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -right-32 h-80 w-80 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-20 blur-3xl" />
            <div className="absolute -bottom-40 -left-32 h-80 w-80 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 opacity-20 blur-3xl" />
          </div>
        </section>

        {/* Stats Section */}
        <LandingStats />

        {/* About Section */}
        <section className="bg-background py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <Badge className="mb-6 px-3 py-1" variant="secondary">
                  About OurDAO
                </Badge>
                <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
                  Redefining Trustless, Private Lending
                </h2>
                <p className="text-muted-foreground mb-8 text-lg leading-relaxed">
                  OurDAO is a privacy-first, decentralized lending protocol built for communities.
                  We combine trustless smart contracts, encrypted document storage, zero-knowledge
                  voting, and real-time transparency to deliver a best-in-class experience for
                  borrowers and lenders.
                </p>
                <div className="mb-10 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  {benefits.map((item) => (
                    <div key={item} className="flex items-center space-x-3">
                      <Check className="h-5 w-5 flex-shrink-0 text-green-500 dark:text-green-400" />
                      <span className="text-foreground text-base">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button asChild size="lg" className="w-full px-6 sm:w-auto">
                    <Link href="/register">Get Started</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full px-6 sm:w-auto">
                    <Link href="/governance">Explore Governance</Link>
                  </Button>
                </div>
              </div>
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:mt-0">
                {features.slice(0, 4).map((f) => {
                  const Icon = f.icon
                  return (
                    <Card key={f.name} className="border-border transition-shadow hover:shadow-md">
                      <CardContent className="p-6">
                        <div
                          className={`h-12 w-12 rounded-lg bg-gradient-to-r ${f.gradient} mb-4 flex items-center justify-center text-white`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                        <h4 className="text-foreground mb-2 text-lg font-semibold">{f.name}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {f.description}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-muted py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <Badge variant="secondary" className="mb-3">
                Our Platform
              </Badge>
              <h2 className="text-foreground mb-6 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Advanced Features for Modern DeFi
              </h2>
              <p className="text-muted-foreground mx-auto text-xl leading-8">
                Built with cutting-edge technology to provide the most comprehensive and secure
                lending experience in DeFi.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <Card
                    key={feature.name}
                    className="border-border h-full border transition-all duration-300 hover:shadow-xl"
                  >
                    <CardHeader className="pb-2">
                      <div
                        className={`h-14 w-14 rounded-xl bg-gradient-to-r ${feature.gradient} mb-6 flex items-center justify-center text-white shadow-sm`}
                      >
                        <Icon className="h-7 w-7" />
                      </div>
                      <CardTitle className="text-foreground mb-2 text-xl font-bold">
                        {feature.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-muted-foreground text-base leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Ready to Join the Future of Lending?
              </h2>
              <p className="mx-auto mb-10 text-xl leading-8 text-blue-100">
                Connect your wallet and become part of a member-owned lending DAO on Stellar.
              </p>

              <LandingBottomCTA />
            </div>
          </div>

          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="h-[40rem] w-[40rem] rounded-full bg-gradient-to-r from-blue-400/20 to-purple-400/20 blur-3xl" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      {/* eslint-disable ourdao/no-raw-gray-classes -- Intentional: the footer is an always-dark
          band in both themes, so raw gray-900 bg with gray-400 text is kept — the
          semantic tokens flip with the theme and would wash out on it (e.g. light-mode
          text-muted-foreground is gray-500, below WCAG AA on the dark footer). */}
      <footer className="bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="py-16">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
              <div className="col-span-1 md:col-span-2">
                <div className="mb-6 flex items-center space-x-3">
                  <OrbitMark className="h-11 w-11" />
                  <h3 className="text-xl font-bold text-white">OurDAO</h3>
                </div>
                <p className="mb-6 max-w-md text-base leading-relaxed text-gray-400">
                  A member-owned peer-to-peer lending DAO on Stellar, with commit-reveal private
                  voting, automated governance, and yield generation.
                </p>
                <div className="flex space-x-4">
                  <a
                    href="https://github.com/ourdao"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 transition-colors hover:text-white"
                    aria-label="OurDAO GitHub"
                  >
                    <GithubMark className="h-6 w-6" />
                  </a>
                </div>
              </div>

              <div>
                <h4 className="mb-4 text-base font-semibold text-white">Product</h4>
                <ul className="space-y-3">
                  <li>
                    <Link
                      href="/loans"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      Loans
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/governance"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      Governance
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/treasury"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      Treasury
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/privacy"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      Privacy
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="mb-4 text-base font-semibold text-white">Resources</h4>
                <ul className="space-y-3">
                  <li>
                    <span className="text-sm text-gray-400">Documentation</span>
                  </li>
                  <li>
                    <a
                      href="https://github.com/ourdao"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <LandingContractLink />
                  </li>
                  <li>
                    <span className="text-sm text-gray-400">Support</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 py-8">
            <div className="flex flex-col items-center justify-between md:flex-row">
              <p className="text-sm text-gray-400">
                © {new Date().getFullYear()} OurDAO. All rights reserved.
              </p>
              <div className="mt-4 flex space-x-6 md:mt-0">
                <a
                  href="/privacy"
                  className="text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  Privacy Policy
                </a>
                <a
                  href="/terms"
                  className="text-sm text-gray-400 transition-colors hover:text-gray-200"
                >
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
      {/* eslint-enable ourdao/no-raw-gray-classes */}
    </div>
  )
}
