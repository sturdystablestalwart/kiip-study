const { test, expect } = require('@playwright/test');

// Dynamic port handling - Vite may use different ports
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || 'http://localhost:5000';

/* ───────── Home Page ───────── */

test.describe('Home Page', () => {

  test('loads and shows "Your Tests" heading', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('h1')).toContainText('Your Tests');
  });

  test('shows KIIP Study logo in nav', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: 'KIIP Study' })).toBeVisible();
  });

  test('shows Tests nav link', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: 'Tests' })).toBeVisible();
  });

  test('shows Endless Practice card', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('Endless Practice')).toBeVisible();
  });

  test('shows All Tests section with filter dropdowns', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('All Tests')).toBeVisible();
  });

  test('shows "Not attempted yet" for unattempted tests', async ({ page }) => {
    await page.goto(BASE_URL);
    const testCard = page.locator('a[href^="/test/"]').first();
    const count = await testCard.count();
    if (count > 0) {
      await expect(page.getByText('Not attempted yet').first()).toBeVisible();
    }
  });

  test('can navigate to a test if one exists', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    // Skip endless card, get test cards only
    const testCard = page.locator('a[href^="/test/"]').filter({ hasNot: page.locator('text=Endless') }).first();
    const count = await testCard.count();
    if (count > 0) {
      await testCard.click();
      // Test title is an h3 inside TestTitle styled component
      await expect(page.locator('h3').first()).toBeVisible({ timeout: 10000 });
    } else {
      await expect(page.getByText('No tests found')).toBeVisible();
    }
  });

});

/* ───────── Create Test Page (admin-only, skip if not logged in) ───────── */

test.describe('Create Test Page', () => {

  test('shows Create Test heading when navigated directly', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    // If not admin, may redirect or show nothing — check for either heading or redirect
    const heading = page.locator('h1');
    const headingCount = await heading.count();
    if (headingCount > 0) {
      const text = await heading.textContent();
      // Either shows "Create Test" (admin) or "Your Tests" (redirected to home)
      expect(text).toMatch(/Create Test|Your Tests/);
    }
  });

  test('shows text input section with placeholder', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const textarea = page.getByPlaceholder(/Paste or type/);
    const count = await textarea.count();
    if (count > 0) {
      await expect(textarea).toBeVisible();
    }
  });

  test('shows "Paste study material" label', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const label = page.getByText('Paste study material');
    const count = await label.count();
    if (count > 0) {
      await expect(label).toBeVisible();
    }
  });

  test('shows document upload section', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const label = page.getByText('Or upload a document');
    const count = await label.count();
    if (count > 0) {
      await expect(label).toBeVisible();
    }
  });

  test('shows character count when typing', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const textarea = page.getByPlaceholder(/Paste or type/);
    const count = await textarea.count();
    if (count > 0) {
      await textarea.fill('Test content for character counting');
      await expect(page.getByText(/\d+ \/ 50,000/)).toBeVisible();
    }
  });

  test('disables Generate button when text too short', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const textarea = page.getByPlaceholder(/Paste or type/);
    const count = await textarea.count();
    if (count > 0) {
      await textarea.fill('Too short');
      await expect(page.getByRole('button', { name: 'Generate Test' })).toBeDisabled();
    }
  });

  test('enables Generate button when >= 200 characters', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const textarea = page.getByPlaceholder(/Paste or type/);
    const count = await textarea.count();
    if (count > 0) {
      const longText = '한국어 공부 테스트입니다. '.repeat(20);
      await textarea.fill(longText);
      await expect(page.getByRole('button', { name: 'Generate Test' })).toBeEnabled();
    }
  });

});

/* ───────── Test Taking Flow ───────── */

test.describe('Test Taking Flow', () => {

  // Helper to navigate to the first available test
  async function goToFirstTest(page) {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    const testCard = page.locator('a[href^="/test/"]').filter({ hasNot: page.locator('text=Endless') }).first();
    const count = await testCard.count();
    if (count === 0) return false;
    await testCard.click();
    await page.waitForSelector('h3', { timeout: 10000 });
    return true;
  }

  test('shows test title as h3', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    await expect(page.locator('h3').first()).toBeVisible();
  });

  test('shows mode selector with Test and Practice options', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    const select = page.locator('select');
    await expect(select).toBeVisible();
    await expect(page.getByText('Mode:')).toBeVisible();
  });

  test('shows timer in MM:SS format', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    await expect(page.getByText(/\d+:\d{2}/)).toBeVisible();
  });

  test('shows "Back to Tests" exit button', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    await expect(page.getByRole('button', { name: 'Back to Tests' })).toBeVisible();
  });

  test('shows question navigation dots', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Use exact match to avoid "Question 1" matching "Question 10"
    await expect(page.getByRole('button', { name: 'Question 1', exact: true })).toBeVisible();
  });

  test('question dots allow jumping to a specific question', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    await page.getByRole('button', { name: 'Question 10' }).click();
    // Question text should start with "10."
    await expect(page.locator('h2')).toContainText('10.');
  });

  test('Previous is disabled on question 1, Next navigates forward', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('h2')).toContainText('2.');
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled();
  });

  test('selecting an answer keeps option visible', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    const count = await firstOption.count();
    if (count > 0) {
      await firstOption.click();
      await expect(firstOption).toBeVisible();
    }
  });

});

/* ───────── Practice Mode ───────── */

test.describe('Practice Mode', () => {

  async function goToFirstTest(page) {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    const testCard = page.locator('a[href^="/test/"]').filter({ hasNot: page.locator('text=Endless') }).first();
    const count = await testCard.count();
    if (count === 0) return false;
    await testCard.click();
    await page.waitForSelector('h3', { timeout: 10000 });
    return true;
  }

  test('switching mode shows confirmation modal when progress exists', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Answer a question to create progress — try MCQ option first, fallback to text input
    const mcqOption = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await mcqOption.count() > 0) {
      await mcqOption.click();
    } else {
      const textInput = page.locator('input[type="text"]').first();
      if (await textInput.count() > 0) {
        await textInput.fill('test answer');
        await textInput.press('Enter');
      }
    }
    // Now switch mode — should trigger modal
    await page.locator('select').selectOption('Practice');
    await expect(page.getByText(/Switching modes will reset/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  test('Practice mode shows instant feedback with explanation', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Switch to Practice mode (no progress yet, so direct switch)
    await page.locator('select').selectOption('Practice');
    // If modal appeared (unlikely without progress), confirm it
    const confirmBtn = page.getByRole('button', { name: 'Confirm' });
    if (await confirmBtn.count() > 0 && await confirmBtn.isVisible()) {
      await confirmBtn.click();
    }
    // Click an answer option
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    const count = await firstOption.count();
    if (count > 0) {
      await firstOption.click();
      await expect(page.getByText('Why?')).toBeVisible({ timeout: 5000 });
    }
  });

  test('Test mode hides feedback until submission', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Stay in Test mode (default)
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    const count = await firstOption.count();
    if (count > 0) {
      await firstOption.click();
      await expect(page.getByText('Why?')).not.toBeVisible();
    }
  });

});

/* ───────── Exit and Navigation ───────── */

test.describe('Exit and Navigation', () => {

  async function goToFirstTest(page) {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    const testCard = page.locator('a[href^="/test/"]').filter({ hasNot: page.locator('text=Endless') }).first();
    const count = await testCard.count();
    if (count === 0) return false;
    await testCard.click();
    await page.waitForSelector('h3', { timeout: 10000 });
    return true;
  }

  test('"Back to Tests" shows confirmation modal when progress exists', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Answer a question first to create progress
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    if (await firstOption.count() > 0) await firstOption.click();
    // Now exit — should show modal
    await page.getByRole('button', { name: 'Back to Tests' }).click();
    await expect(page.getByText(/unsaved progress/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible();
  });

  test('Cancel dismisses exit modal', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Answer a question to trigger modal on exit
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    if (await firstOption.count() > 0) await firstOption.click();
    await page.getByRole('button', { name: 'Back to Tests' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/unsaved progress/)).not.toBeVisible();
    await expect(page.locator('h3').first()).toBeVisible();
  });

  test('Confirm returns to home page', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // Answer a question to trigger modal on exit
    const firstOption = page.locator('button').filter({ hasText: /^1\./ }).first();
    if (await firstOption.count() > 0) await firstOption.click();
    await page.getByRole('button', { name: 'Back to Tests' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(BASE_URL + '/');
    await expect(page.locator('h1')).toContainText('Your Tests');
  });

});

/* ───────── Delete Test Flow (admin-only) ───────── */

test.describe('Delete Test Flow', () => {

  test('delete button and modal work when visible (admin only)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');

    // Delete button only visible to admins — check if any exist
    const deleteButton = page.locator('button').filter({ hasText: '×' }).first();
    const count = await deleteButton.count();
    if (count === 0) {
      // Not admin — skip gracefully
      return;
    }

    // Click delete — confirmation modal should appear
    await deleteButton.click();
    await expect(page.getByText('Remove this test?')).toBeVisible();
    await expect(page.getByText(/permanently removed/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep it' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove' })).toBeVisible();

    // "Keep it" dismisses modal
    await page.getByRole('button', { name: 'Keep it' }).click();
    await expect(page.getByText('Remove this test?')).not.toBeVisible();
  });

});

/* ───────── Error Handling ───────── */

test.describe('Error Handling', () => {

  test('Home shows error when API is unreachable', async ({ page }) => {
    // Block all API test-list requests
    await page.route('**/api/tests**', route => route.abort());
    await page.goto(BASE_URL);
    // Should show error banner — use first() to avoid strict mode with multiple matches
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 15000 });
  });

  test('Home shows "Try again" button on error', async ({ page }) => {
    await page.route('**/api/tests**', route => route.abort());
    await page.goto(BASE_URL);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 15000 });
  });

  test('invalid test ID shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/test/invalid-id-12345`);
    // Should show "Something went wrong" heading
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible({ timeout: 10000 });
  });

});

/* ───────── 404 Page ───────── */

test.describe('404 Page', () => {

  test('unknown routes show "Page not found"', async ({ page }) => {
    await page.goto(`${BASE_URL}/this-page-does-not-exist`);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

});

/* ───────── Accessibility ───────── */

test.describe('Accessibility', () => {

  test('all visible buttons have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute('aria-label') || await button.textContent();
      expect(name).toBeTruthy();
    }
  });

  test('navigation links have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('link', { name: 'KIIP Study' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tests' })).toBeVisible();
  });

  test('Create Test textarea has a placeholder', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    const textarea = page.getByRole('textbox');
    const count = await textarea.count();
    if (count > 0) {
      const placeholder = await textarea.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    }
  });

});

/* ───────── API Health ───────── */

/* ───────── Endless Mode ───────── */

test.describe('Endless Mode', () => {

  test('shows start screen with title and start button', async ({ page }) => {
    await page.goto(`${BASE_URL}/endless`);
    await expect(page.getByText('Endless Practice')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Practicing/i })).toBeVisible();
  });

  test('shows filter dropdowns on start screen', async ({ page }) => {
    await page.goto(`${BASE_URL}/endless`);
    // Wait for lazy-loaded page to render
    await expect(page.getByText('Endless Practice')).toBeVisible({ timeout: 5000 });
    // Filter dropdowns should exist on the start screen
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
    expect(await selects.count()).toBeGreaterThanOrEqual(2);
  });

});

/* ───────── Keyboard Shortcuts ───────── */

test.describe('Keyboard Shortcuts', () => {

  test('Ctrl+P opens command palette', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    await page.keyboard.press('Control+p');
    // Command palette should show with search input
    await expect(page.getByPlaceholder(/Search tests/i)).toBeVisible({ timeout: 3000 });
  });

  test('Ctrl+K opens shortcuts modal', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    await page.keyboard.press('Control+k');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3000 });
  });

  test('Escape closes shortcuts modal', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    await page.keyboard.press('Control+k');
    await expect(page.getByText('Keyboard Shortcuts')).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Keyboard Shortcuts')).not.toBeVisible();
  });

  test('Escape closes command palette', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    await page.keyboard.press('Control+p');
    await expect(page.getByPlaceholder(/Search tests/i)).toBeVisible({ timeout: 3000 });
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder(/Search tests/i)).not.toBeVisible();
  });

});

/* ───────── Filters ───────── */

test.describe('Filter Dropdowns', () => {

  test('Home page has Level and Unit filter dropdowns', async ({ page }) => {
    await page.goto(BASE_URL);
    // Filter dropdowns use "Level" and "Unit" as default option text
    await expect(page.getByText('All Tests')).toBeVisible();
    // Check that select elements exist in the filter bar
    const selects = page.locator('select');
    expect(await selects.count()).toBeGreaterThanOrEqual(2);
  });

  test('shows test count after loading', async ({ page }) => {
    await page.goto(BASE_URL);
    // If there are tests, "Showing N tests" should appear
    const count = page.getByText(/Showing \d+ tests/);
    const c = await count.count();
    if (c > 0) {
      await expect(count).toBeVisible();
    }
  });

});

/* ───────── Theme and Language ───────── */

test.describe('Theme and Language', () => {

  test('theme toggle button is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    // Theme toggle shows one of ○ ● ◐
    const toggle = page.locator('button[aria-label*="mode"]');
    await expect(toggle).toBeVisible();
  });

  test('language toggle button is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    const langBtn = page.locator('button[aria-label="Change language"]');
    await expect(langBtn).toBeVisible();
  });

  test('clicking language toggle cycles to next language', async ({ page }) => {
    await page.goto(BASE_URL);
    const langBtn = page.locator('button[aria-label="Change language"]');
    await langBtn.click();
    // Wait for re-render after language change
    await page.waitForTimeout(300);
    const newText = await langBtn.textContent();
    // After clicking, should show a different language label
    const validLabels = ['EN', '한국어', 'РУ', 'ES'];
    expect(validLabels).toContain(newText.trim());
  });

});

/* ───────── Auth UI ───────── */

test.describe('Auth UI', () => {

  test('shows Sign in link when not authenticated', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByText('Sign in')).toBeVisible();
  });

  test('Sign in link points to Google OAuth', async ({ page }) => {
    await page.goto(BASE_URL);
    const signIn = page.getByText('Sign in');
    const href = await signIn.getAttribute('href');
    expect(href).toContain('/api/auth/google/start');
  });

});

/* ───────── Mode Direct Switch ───────── */

test.describe('Mode Direct Switch', () => {

  async function goToFirstTest(page) {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    const testCard = page.locator('a[href^="/test/"]').filter({ hasNot: page.locator('text=Endless') }).first();
    const count = await testCard.count();
    if (count === 0) return false;
    await testCard.click();
    await page.waitForSelector('h3', { timeout: 10000 });
    return true;
  }

  test('switching mode without progress skips confirmation', async ({ page }) => {
    if (!await goToFirstTest(page)) return;
    // No answers yet — mode switch should be instant (no modal)
    await page.locator('select').selectOption('Practice');
    // No modal should appear
    await expect(page.getByText(/Switching modes will reset/)).not.toBeVisible();
  });

});

/* ───────── API Health ───────── */

test.describe('API Health', () => {

  test('server health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.mongo).toBe('connected');
  });

  test('API returns test list', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/tests?limit=5`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('tests');
    expect(Array.isArray(body.tests)).toBe(true);
  });

  test('endless endpoint requires authentication', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/tests/endless?limit=5`);
    // Should return 401 since endless requires auth
    expect(response.status()).toBe(401);
  });

});

/* ───────── Accessibility — axe-core ───────── */

const AxeBuilder = require('@axe-core/playwright').default;

test.describe('Accessibility', () => {

  test('Home page has no critical a11y violations', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('h1');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toEqual([]);
  });

  test('Create Test page has no critical a11y violations', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(1000);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toEqual([]);
  });

  test('404 page has no critical a11y violations', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page`);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const critical = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toEqual([]);
  });

});
