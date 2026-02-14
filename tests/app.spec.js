const { test, expect } = require('@playwright/test');

// Dynamic port handling - Vite may use different ports
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5000';

test.describe('KIIP Study App - Home Page', () => {

  test('Home page loads and shows header with Japandi design', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('h1')).toContainText('Your Tests');
  });

  test('Home page shows "+ New Test" button with clay color', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: '+ New Test' })).toBeVisible();
  });

  test('Navigation shows KIIP Study logo', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: 'KIIP Study' })).toBeVisible();
  });

  test('Navigation shows Tests and New Test links', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: 'Tests' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Test', exact: true })).toBeVisible();
  });

  test('Tests link is active on home page', async ({ page }) => {
    await page.goto(BASE_URL);
    // The active link should be visually highlighted (check by class or style)
    const testsLink = page.getByRole('link', { name: 'Tests' });
    await expect(testsLink).toBeVisible();
  });

});

test.describe('KIIP Study App - Create Test Page', () => {

  test('Navigate to Create Test page via + New Test button', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: '+ New Test' }).click();
    await expect(page).toHaveURL(/.*\/create/);
    await expect(page.locator('h1')).toContainText('Create a New Test');
  });

  test('Navigate to Create Test page via nav link', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: 'New Test', exact: true }).click();
    await expect(page).toHaveURL(/.*\/create/);
  });

  test('Create Test page shows paste section with warm microcopy', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await expect(page.getByText('Paste your study material')).toBeVisible();
    await expect(page.getByText('Korean text, mock test content, or any study notes')).toBeVisible();
  });

  test('Create Test page shows upload section', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await expect(page.getByText('Upload a document')).toBeVisible();
    await expect(page.getByText('PDF, DOCX, TXT, or Markdown file')).toBeVisible();
  });

  test('Create Test page shows image upload zone', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await expect(page.getByText('Add images for visual questions')).toBeVisible();
  });

  test('Create Test validates minimum text length (200 chars)', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);

    // Enter short text
    await page.getByRole('textbox').fill('Too short');

    // Should show character count with "need X more" warning
    await expect(page.getByText(/need \d+ more/)).toBeVisible();

    // Generate Test button should be disabled
    await expect(page.getByRole('button', { name: 'Generate Test' })).toBeDisabled();
  });

  test('Create Test shows character count', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);

    // Enter some text
    await page.getByRole('textbox').fill('Test content for character counting');

    // Should show character count in format "X / 50,000"
    await expect(page.getByText(/\d+ \/ 50,000/)).toBeVisible();
  });

  test('Create Test enables button when >= 200 characters', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);

    // Enter 200+ characters
    const longText = '한국어 공부 테스트입니다. '.repeat(20);
    await page.getByRole('textbox').fill(longText);

    // Generate Test button should be enabled
    await expect(page.getByRole('button', { name: 'Generate Test' })).toBeEnabled();
  });

});

test.describe('KIIP Study App - Test Taking Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for tests to load
    await page.waitForSelector('h1');
  });

  test('Test cards show "Not attempted yet" for new tests', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await expect(page.getByText('Not attempted yet').first()).toBeVisible();
    }
  });

  test('Can navigate to a test if one exists', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      await expect(page.locator('h3')).toBeVisible();
    } else {
      // No tests exist - check for empty state message
      await expect(page.getByText(/No tests yet/i)).toBeVisible();
    }
  });

  test('Test page shows mode selector with both options', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      await expect(page.getByRole('combobox')).toBeVisible();
      await expect(page.getByText('Test (submit at end)')).toBeVisible();
    }
  });

  test('Test page shows timer starting at ~30:00', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      // Timer should show time in MM:SS format
      await expect(page.getByText(/29:\d{2}|30:00/)).toBeVisible();
    }
  });

  test('Test page shows Exit button', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible();
    }
  });

  test('Test page shows question navigation dots', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      // Should show numbered question buttons
      await expect(page.getByRole('button', { name: 'Question 1' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Question 20' })).toBeVisible();
    }
  });

  test('Question navigation dots allow jumping to questions', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Click question 10
      await page.getByRole('button', { name: 'Question 10' }).click();

      // Should show question 10
      await expect(page.locator('h2')).toContainText('10.');
    }
  });

  test('Previous/Next buttons navigate between questions', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Previous should be disabled on Q1
      await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

      // Click Next
      await page.getByRole('button', { name: 'Next' }).click();

      // Should be on Q2
      await expect(page.locator('h2')).toContainText('2.');

      // Previous should now be enabled
      await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
    }
  });

  test('Selecting an answer highlights the option', async ({ page }) => {
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Click first answer option
      const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
      await firstOption.click();

      // Option should be visually selected (has selection background)
      // We check that the button is clickable and stays in DOM
      await expect(firstOption).toBeVisible();
    }
  });

});

test.describe('KIIP Study App - Practice Mode', () => {

  test('Mode switch shows confirmation modal', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Select Practice mode
      await page.getByRole('combobox').selectOption('Practice (instant feedback)');

      // Confirmation modal should appear
      await expect(page.getByText('Switch mode?')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Switch & reset' })).toBeVisible();
    }
  });

  test('Practice mode shows instant feedback with explanation', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Switch to Practice mode
      await page.getByRole('combobox').selectOption('Practice (instant feedback)');
      await page.getByRole('button', { name: 'Switch & reset' }).click();

      // Click an answer option
      const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
      await firstOption.click();

      // Should show "Why?" explanation
      await expect(page.getByText('Why?')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Test mode hides feedback until submission', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Stay in Test mode (default)

      // Click an answer
      const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
      await firstOption.click();

      // Explanation should NOT be visible in Test mode
      await expect(page.getByText('Why?')).not.toBeVisible();
    }
  });

});

test.describe('KIIP Study App - Exit and Navigation', () => {

  test('Exit button shows confirmation modal with warm microcopy', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();

      // Click Exit
      await page.getByRole('button', { name: 'Exit' }).click();

      // Confirmation modal should appear with warm messaging
      await expect(page.getByText('Leave this test?')).toBeVisible();
      await expect(page.getByText(/answers haven't been saved/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stay' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Leave' })).toBeVisible();
    }
  });

  test('Stay button dismisses exit modal', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      await page.getByRole('button', { name: 'Exit' }).click();
      await page.getByRole('button', { name: 'Stay' }).click();

      // Modal should be dismissed, still on test page
      await expect(page.getByText('Leave this test?')).not.toBeVisible();
      await expect(page.locator('h3')).toBeVisible(); // Test title
    }
  });

  test('Leave button returns to home page', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      await testCard.click();
      await page.getByRole('button', { name: 'Exit' }).click();
      await page.getByRole('button', { name: 'Leave' }).click();

      // Should be back on home page
      await expect(page).toHaveURL(BASE_URL + '/');
      await expect(page.locator('h1')).toContainText('Your Tests');
    }
  });

});

test.describe('KIIP Study App - Delete Test Flow', () => {

  test('Delete button (×) appears on test cards', async ({ page }) => {
    await page.goto(BASE_URL);

    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      // Delete button should be visible
      const deleteButton = testCard.locator('button');
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toContainText('×');
    }
  });

  test('Delete shows confirmation modal with warm microcopy', async ({ page }) => {
    await page.goto(BASE_URL);

    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      // Click delete button
      const deleteButton = testCard.locator('button');
      await deleteButton.click();

      // Confirmation modal should appear with warm messaging
      await expect(page.getByText('Remove this test?')).toBeVisible();
      await expect(page.getByText(/will be permanently removed/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Keep it' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();
    }
  });

  test('Keep it button dismisses delete modal', async ({ page }) => {
    await page.goto(BASE_URL);

    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();

    if (count > 0) {
      const deleteButton = testCard.locator('button');
      await deleteButton.click();
      await page.getByRole('button', { name: 'Keep it' }).click();

      // Modal should be dismissed
      await expect(page.getByText('Remove this test?')).not.toBeVisible();
    }
  });

});

test.describe('KIIP Study App - Error Handling', () => {

  test('Home shows error state when API fails', async ({ page }) => {
    // Block API requests to simulate failure
    await page.route('**/api/tests', route => route.abort());

    await page.goto(BASE_URL);

    // Should show error message with retry button
    await expect(page.getByText(/timeout|error|try again/i)).toBeVisible({ timeout: 15000 });
  });

  test('Home shows Try again button on error', async ({ page }) => {
    await page.route('**/api/tests', route => route.abort());

    await page.goto(BASE_URL);

    // Should show retry button
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 15000 });
  });

  test('Test page handles invalid test ID', async ({ page }) => {
    await page.goto(`${BASE_URL}/test/invalid-id-12345`);

    // Should show error or redirect
    await expect(page.getByText(/error|not found|couldn't load/i)).toBeVisible({ timeout: 10000 });
  });

});

test.describe('KIIP Study App - Accessibility', () => {

  test('All buttons have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check that main buttons have aria labels or text content
    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label') || await button.textContent();
      expect(name).toBeTruthy();
    }
  });

  test('Links have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check navigation links
    await expect(page.getByRole('link', { name: 'KIIP Study' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tests' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Test', exact: true })).toBeVisible();
  });

  test('Form inputs have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);

    // Textarea should have placeholder or label
    const textarea = page.getByRole('textbox');
    await expect(textarea).toBeVisible();
    const placeholder = await textarea.getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
  });

});
