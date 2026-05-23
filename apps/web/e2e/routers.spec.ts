import { test, expect } from '@playwright/test'

test.use({ storageState: 'e2e/.auth.json' })

test.describe('Routers page', () => {
  test('shows routers list', async ({ page }) => {
    await page.goto('/routers')
    await expect(page.getByRole('heading', { name: 'Routers' })).toBeVisible()
    await expect(page.getByRole('button', { name: /tambah router/i })).toBeVisible()
  })

  test('open add router modal', async ({ page }) => {
    await page.goto('/routers')
    await page.getByRole('button', { name: /tambah router/i }).click()
    await expect(page.getByText('Tambah Router').nth(1)).toBeVisible()
    await expect(page.getByLabel('Nama Router')).toBeVisible()
  })

  test('show validation error when saving empty form', async ({ page }) => {
    await page.goto('/routers')
    await page.getByRole('button', { name: /tambah router/i }).click()
    await page.getByRole('button', { name: /simpan/i }).click()
    await expect(page.getByText(/wajib diisi/i)).toBeVisible()
  })
})

test.describe('Routers — setup auth', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL('/')
    await context.storageState({ path: 'e2e/.auth.json' })
    await context.close()
  })

  test('placeholder — auth state saved', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
  })
})
