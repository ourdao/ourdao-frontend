import { test, expect } from '@playwright/test'
import { setupE2ETest, MOCK_WALLET_ADDRESS } from './helpers'

/**
 * End-to-end smoke test suite (#374).
 * Exercises the five critical user journeys in a real browser:
 * 1. Load (app shell, routing, landing page)
 * 2. Connect (Freighter wallet handshake)
 * 3. Register (member onboarding flow)
 * 4. Request Loan (loan proposal creation flow)
 * 5. Vote (governance voting on active proposal)
 */

test.describe('E2E Smoke Tests', () => {
  test('flow 1: load landing page and verify navigation and shell', async ({ page }) => {
    await setupE2ETest(page)
    await page.goto('/')

    // Verify main landing page elements are visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('button', { name: 'Connect Wallet', exact: true })).toBeVisible()

    // Verify navigation links
    const nav = page.getByRole('navigation')
    await expect(nav).toBeVisible()
  })

  test('flow 2: connect wallet with Freighter extension stub', async ({ page }) => {
    await setupE2ETest(page)
    await page.goto('/')

    const connectBtn = page.getByRole('banner').getByRole('button', { name: 'Connect Wallet', exact: true })
    await expect(connectBtn).toBeVisible()
    await connectBtn.click()

    // Upon connection, the button reflects the truncated address or connected state
    const truncated = `${MOCK_WALLET_ADDRESS.slice(0, 4)}...${MOCK_WALLET_ADDRESS.slice(-4)}`
    await expect(
      page.getByText(truncated).or(page.getByRole('button', { name: new RegExp(truncated, 'i') }))
    ).toBeVisible()
  })

  test('flow 3: register new member flow', async ({ page }) => {
    // Start with auto-connected wallet but unregistered (isMember: false)
    await setupE2ETest(page, {
      freighter: { autoConnect: true },
      isMember: false,
    })

    await page.goto('/register')

    // Step 1: Membership fee & benefits
    await expect(page.getByRole('heading', { name: 'Welcome to OurDAO', exact: true })).toBeVisible()
    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await expect(nextBtn).toBeVisible()
    await nextBtn.click()

    // Step 2: Accept terms and submit registration
    await expect(page.getByRole('heading', { name: /complete registration/i })).toBeVisible()
    const termsCheckbox = page.locator('#acceptTerms')
    await expect(termsCheckbox).toBeVisible()
    await termsCheckbox.check()

    const registerBtn = page.getByRole('button', { name: /register now/i })
    await expect(registerBtn).toBeEnabled()
    await registerBtn.click()

    // Verify successful registration banner or feedback
    await expect(page.getByText('Registration successful! Welcome to the DAO!')).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Member Dashboard' })).toBeVisible()
  })

  test('flow 4: request loan flow', async ({ page }) => {
    // Connected member wallet
    await setupE2ETest(page, {
      freighter: { autoConnect: true },
      isMember: true,
      hasActiveLoan: false,
    })

    await page.goto('/loans/request')

    // Verify loan request form is loaded
    await expect(page.getByRole('heading', { name: /request loan|request a loan/i })).toBeVisible()

    // Enter loan amount
    const amountInput = page.getByRole('spinbutton', { name: /loan amount/i })
    await expect(amountInput).toBeVisible()
    await amountInput.fill('100')

    // Advance through the form steps
    const nextBtn = page.getByRole('button', { name: 'Next', exact: true })
    await nextBtn.click()
    await expect(page.getByRole('heading', { name: 'Supporting Documents' })).toBeVisible()
    await nextBtn.click()
    await expect(page.getByRole('heading', { name: 'Review & Submit' })).toBeVisible()

    // Submit the loan request
    const submitBtn = page.getByRole('button', { name: 'Submit Request', exact: true })
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()

    // Check for success feedback
    await expect(page.getByText('Loan request submitted successfully!', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/loans$/)
  })

  test('flow 5: vote on proposal flow', async ({ page }) => {
    // Connected member wallet
    await setupE2ETest(page, {
      freighter: { autoConnect: true },
      isMember: true,
    })

    await page.goto('/governance')

    // Verify proposals section is loaded
    await expect(page.getByRole('heading', { name: /governance/i })).toBeVisible()

    // Locate the vote button on the active proposal
    const voteBtn = page.getByRole('button', { name: 'Vote for', exact: true })
    await expect(voteBtn).toBeVisible()
    await voteBtn.click()

    // Wait for confirmation, so the optimistic voted state alone cannot pass.
    await expect(page.getByRole('link', { name: 'View transaction' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("You've voted", { exact: true })).toBeVisible()
    await expect(voteBtn).toHaveCount(0)
  })
})
