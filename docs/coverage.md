# Coverage baseline (issue #240)

**Date:** 2026-09-26
**Status:** Initial adoption — ratchet threshold, not gate.
**Config:** `vitest.config.mts` (`provider: 'v8'`, reporters `text` +
`json-summary` + `html`, excludes for tests / generated files / config).
**CI:** The `coverage` job in `.github/workflows/ci.yml` uses Node 24, installs
dependencies with `npm ci` and runs `npm run coverage` to enforce the thresholds.
It publishes `coverage/coverage-summary.json` to the job output
(`$GITHUB_STEP_SUMMARY`) and uploads `coverage/` as an artifact.
**Thresholds:** `lines/functions/branches/statements: 40` — intentionally at
initial-adoption level so the job ratchets rather than failing on adoption.
Raise after the first green summary lands.
**Per-module floors (#327):** `src/lib/dao-client.ts` (statements/branches 80)
and `src/lib/wallet.tsx` (statements 80, branches 75) — the code that moves
funds and gates every signature. Measured at the time of setting: dao-client
86.9% / 85.4%, wallet 95.6% / 83.1%. The provider version must track the
installed `vitest` version (a 4.x provider against vitest 5 crashes the run).

## How to read the report

- `npm run coverage` locally (after `npm install --no-save
@vitest/coverage-v8@5.0.5`) prints a per-file table and writes
  `coverage/coverage-summary.json` + `coverage/index.html`.

> **Note:** Local coverage measurement requires Node 24.15+ due to locked Vitest and jsdom dependencies. The `test` and `build` scripts work on Node 20 (as specified in `.nvmrc`), but `npm run coverage` needs the newer runtime.

- In CI, the same summary is appended to the job output under
  “Coverage summary” with a per-file `<details>` block.

## Known gaps (become their own issues — out of scope here)

- `src/app/api/documents/route.ts` has no test at all (found by listing
  `test/` vs. `src/`).
- `next.config.ts` CSP/headers now covered by `test/security-headers.test.ts`
  (#239); `src/lib/wallet.tsx` mismatch paths by
  `test/network-mismatch.test.tsx` (#241); interactive surfaces by
  `test/a11y.test.tsx` (#238).
- Follow-ups should open issues for significant uncovered modules rather than
  raising the threshold and writing tests in the same PR.

## First-run checklist for maintainers

1. Merge this PR and read the `Coverage` job summary on `main`.
2. Paste the per-file table into this doc as the measured baseline.
3. Raise `thresholds` in `vitest.config.mts` to just below the measured
   totals and open gaps as follow-up issues.
