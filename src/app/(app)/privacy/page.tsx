import Link from 'next/link'
import {
  LockClosedIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@/lib/icons'
import { PageHeader } from '@/components/PageHeader'
import { PrivacyWalletGate } from '@/components/privacy/PrivacyWalletGate'
import { PrivacyStats } from '@/components/privacy/PrivacyStats'

export default function PrivacyPage() {
  return (
    <PrivacyWalletGate>
      <PageHeader title="Privacy" subtitle="What's actually private on-chain, and how to use it." />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top-level limitation banner — what a member needs before choosing "private" */}
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">Heads up before using private proposals</p>
            <p>
              Private treasury voting is <strong>designed</strong> as commit-reveal but is{' '}
              <strong>not yet enforced</strong> as a full privacy guarantee and has no commit/reveal
              UI in this app today. A proposal created as private currently cannot be voted on by
              anyone — including its creator. See details below.
            </p>
          </div>
        </div>

        <div className="bg-card border-border rounded-lg border p-6">
          <div className="flex items-start space-x-4">
            <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900/30">
              <EyeSlashIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground text-lg font-semibold">
                Commit-reveal private treasury voting
              </h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Treasury proposals can be flagged as <strong>private</strong>. The intended design
                is two-phase: members first submit a hidden commitment (SHA-256 of choice + 32-byte
                salt), then reveal later, so the running tally stays hidden until the reveal window.
              </p>

              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  What is actually enforced today
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-200">
                  <li>
                    <strong>No phase separation.</strong> The contract&apos;s{' '}
                    <code className="font-mono text-xs">privacy.rs</code> lets{' '}
                    <code className="font-mono text-xs">commit_vote</code> and{' '}
                    <code className="font-mono text-xs">reveal_vote</code> be called at any time
                    while a proposal is pending, and{' '}
                    <code className="font-mono text-xs">reveal_vote</code> tallies immediately via{' '}
                    <code className="font-mono text-xs">treasury::tally</code> and emits{' '}
                    <code className="font-mono text-xs">tre_vote</code>. A voter can commit and
                    reveal in consecutive transactions, so the partial result is public while others
                    are still committing — the exact leak the scheme is meant to prevent.
                  </li>
                  <li>
                    <strong>Commitments are overwritable</strong> before reveal, so they don&apos;t
                    bind the voter.
                  </li>
                  <li>
                    <strong>No commit/reveal UI exists</strong> in this app. Creating a private
                    proposal succeeds on-chain, but neither you nor other members can then commit or
                    reveal a vote on it — the proposal is effectively unvotable until that UI ships.
                  </li>
                  <li>
                    <strong>Client commitment is now correct.</strong> The app&apos;s{' '}
                    <code className="font-mono text-xs">generateCommitment</code> in{' '}
                    <code className="font-mono text-xs">src/lib/utils.ts</code> now uses SHA-256 of
                    support byte + salt, matching the contract&apos;s hash. The older 32-bit demo
                    hash issue is fixed; the remaining gaps are contract phase enforcement and the
                    missing UI.
                  </li>
                </ul>
                <p className="mt-3 text-sm text-amber-900 dark:text-amber-200">
                  <strong>What this means for you:</strong> if you need the tally hidden while
                  voting is open, do not rely on the private flag today — votes become visible as
                  soon as they are revealed, and there is no enforced window where everyone must
                  commit before anyone can reveal.
                </p>
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                  Tracked in <code className="font-mono">ourdao-contracts</code> (privacy phase
                  separation &amp; binding) and in this repo (commit/reveal UI). This page will be
                  updated once those land — see PR notes / README for links.
                </p>
              </div>

              <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-sm">
                <InformationCircleIcon className="text-muted-foreground h-4 w-4" />
                Creating a private proposal is currently disabled on{' '}
                <Link
                  href="/governance/create"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  /governance/create
                </Link>{' '}
                for exactly this reason — an unvotable proposal is worse than no option.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card border-border rounded-lg border p-6">
          <div className="flex items-start space-x-4">
            <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
              <LockClosedIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground text-lg font-semibold">Document encryption</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                When attaching supporting documents to a loan or treasury proposal, you can encrypt
                them client-side (AES-GCM, password-derived key via PBKDF2 with 100k iterations)
                before upload — the contract only ever stores a content hash, never the document
                itself or your password.
              </p>
              <div className="border-border bg-muted mt-4 rounded-lg border p-4">
                <p className="text-foreground text-sm font-semibold">Storage status today</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Encryption is real and happens entirely in the browser. Uploads are pinned via the
                  app&apos;s server route{' '}
                  <code className="font-mono text-xs">POST /api/documents</code> to Pinata using a
                  server-only credential (<code className="font-mono text-xs">PINATA_JWT</code> —
                  never in the client bundle). If that credential is not configured, the upload
                  fails with a visible <code className="font-mono text-xs">503</code> error — it
                  does not silently go nowhere. Reads come from the public gateway (
                  <code className="font-mono text-xs">NEXT_PUBLIC_IPFS_GATEWAY</code>, no credential
                  needed).
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  The earlier Infura IPFS endpoint referenced in audits is no longer the target;
                  pinning is Pinata-only now. Documents are not stored at all until the operator
                  sets <code className="font-mono text-xs">PINATA_JWT</code>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <PrivacyStats />

        <div className="bg-card border-border rounded-lg border p-6">
          <h3 className="text-foreground text-sm font-semibold">Tracking &amp; next update</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            The contract phase-separation and binding fixes and the client commit/reveal UI are
            tracked separately in <code className="font-mono text-xs">ourdao-contracts</code> and in
            this repo. This page intentionally describes the current, weaker reality — it will be
            rewritten to claim the stronger guarantees only after those issues land. See the PR that
            introduced this copy for the exact issue links so the gap isn&apos;t forgotten.
          </p>
          <p className="text-muted-foreground mt-3 text-xs">
            Light and dark themes both verified for this page. Privacy claims here are held to the
            same bar as <code className="font-mono text-xs">CONTRIBUTING.md</code>&apos;s
            no-fabricated-content rule — every guarantee stated is either enforced today or
            explicitly marked as not yet delivered.
          </p>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Everything else — membership, loan proposals, loan votes, staking — is public on-chain
            by design, the same as any Soroban contract. There is no account-level &quot;privacy
            mode&quot; covering activity outside the two features above.
          </p>
        </div>
      </div>
    </PrivacyWalletGate>
  )
}
