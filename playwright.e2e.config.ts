import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end smoke test suite (#374).
 *
 * Runs against a local dev server with mocked Freighter and route-intercepted
 * Soroban RPC and backend endpoints.
 */
export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_CONTRACT_ID: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
          NEXT_PUBLIC_BACKEND_URL: 'http://localhost:4000',
          NEXT_PUBLIC_SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
          NEXT_PUBLIC_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
        },
      },
})
