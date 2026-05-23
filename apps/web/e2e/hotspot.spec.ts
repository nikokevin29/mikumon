import { test, expect } from '@playwright/test'

test.describe('Hotspot Users page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL('/')
  })

  test('shows hotspot users page', async ({ page }) => {
    await page.goto('/hotspot')
    await expect(page.getByRole('heading', { name: 'Hotspot Users' })).toBeVisible()
    await expect(page.getByRole('button', { name: /generate/i })).toBeVisible()
  })

  test('open generate modal', async ({ page }) => {
    await page.goto('/hotspot')
    await page.getByRole('button', { name: /generate/i }).click()
    await expect(page.getByText('Generate Hotspot Users')).toBeVisible()
    await expect(page.getByLabel('Jumlah User')).toBeVisible()
  })

  test('generate requires router and profile selection', async ({ page }) => {
    await page.goto('/hotspot')
    await page.getByRole('button', { name: /generate/i }).click()
    await page.getByRole('button', { name: /^generate$/i }).click()
    await expect(page.getByText(/router dan profile wajib/i)).toBeVisible()
  })
})

test.describe('Monitoring page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL('/')
  })

  test('shows live monitoring page', async ({ page }) => {
    await page.goto('/monitoring')
    await expect(page.getByRole('heading', { name: 'Live Monitoring' })).toBeVisible()
    await expect(page.getByText(/sesi aktif|live|disconnected/i).first()).toBeVisible()
  })
})

test.describe('Reports page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL('/')
  })

  test('shows sales report page', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: 'Laporan Penjualan' })).toBeVisible()
    await expect(page.getByText('Total Revenue')).toBeVisible()
    await expect(page.getByText('Total Transaksi')).toBeVisible()
  })
})
