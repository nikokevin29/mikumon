import { test, expect } from '@playwright/test'

test.describe('Auth flow', () => {
  test('redirect unauthenticated user to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('show error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('wrong@test.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /masuk/i }).click()
    await expect(page.getByText(/email atau password salah/i)).toBeVisible()
  })

  test('login with valid credentials and redirect to dashboard', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('logout returns to login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@mikumon.local')
    await page.getByLabel('Password').fill('admin123')
    await page.getByRole('button', { name: /masuk/i }).click()
    await page.waitForURL('/')
    await page.getByRole('button', { name: /logout/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })
})
