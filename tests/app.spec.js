const { test, expect } = require('@playwright/test');

test('Home page loads', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('h1')).toContainText('Available Tests');
});
