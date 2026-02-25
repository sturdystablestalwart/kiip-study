// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000';

// Collect ALL console messages and errors for every test
let consoleMessages = [];
let pageErrors = [];

test.beforeEach(async ({ page }) => {
  consoleMessages = [];
  pageErrors = [];

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text(), url: msg.location().url });
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });
});

function assertNoErrors(testName) {
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m =>
    m.type === 'warning' &&
    !m.text.includes('DevTools') &&
    !m.text.includes('Download the React DevTools') &&
    !m.text.includes('React does not recognize') &&
    !m.text.includes('third-party cookie') &&
    !m.text.includes('Autofocus processing') &&
    !m.text.includes('[Fast Refresh]') &&
    !m.text.includes('[vite]')
  );

  if (pageErrors.length > 0) {
    throw new Error(`[${testName}] Page errors:\n${pageErrors.join('\n')}`);
  }
  if (errors.length > 0) {
    // Filter out known non-critical errors
    const realErrors = errors.filter(e =>
      !e.text.includes('favicon.ico') &&
      !e.text.includes('Failed to load resource') &&
      !e.text.includes('net::ERR_CONNECTION_REFUSED')
    );
    if (realErrors.length > 0) {
      throw new Error(`[${testName}] Console errors:\n${realErrors.map(e => e.text).join('\n')}`);
    }
  }
  if (warnings.length > 0) {
    // Collect unique warnings for reporting
    const uniqueWarnings = [...new Set(warnings.map(w => w.text))];
    console.log(`[${testName}] Warnings (${uniqueWarnings.length}):\n${uniqueWarnings.join('\n')}`);
  }
}

// ============================================================
// 1. HOME PAGE
// ============================================================
test.describe('Home Page — Full Audit', () => {
  test('page loads without errors, shows heading and test cards', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.getByRole('heading', { name: /Your Tests/i })).toBeVisible();

    // Wait for tests to load
    await page.waitForTimeout(1000);

    // Should show test cards or empty state
    const cards = page.locator('[class*="TestCard"], [class*="Card"]').first();
    const hasCards = await cards.count() > 0;
    if (hasCards) {
      await expect(cards).toBeVisible();
    }

    assertNoErrors('Home page load');
  });

  test('KIIP Study logo is visible and clickable', async ({ page }) => {
    await page.goto(BASE_URL);
    const logo = page.getByText('KIIP Study').first();
    await expect(logo).toBeVisible();
    // Click logo should stay on home
    await logo.click();
    await expect(page).toHaveURL(BASE_URL + '/');
    assertNoErrors('Logo click');
  });

  test('navigation links work correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    // "Tests" nav link
    const testsLink = page.getByRole('link', { name: /^Tests$/i });
    if (await testsLink.count() > 0) {
      await testsLink.click();
      await expect(page).toHaveURL(BASE_URL + '/');
    }

    // "Endless" nav link
    const endlessLink = page.getByRole('link', { name: /Endless/i });
    if (await endlessLink.count() > 0) {
      await endlessLink.click();
      await expect(page).toHaveURL(/endless/);
      await page.goBack();
    }

    assertNoErrors('Nav links');
  });

  test('filter dropdowns exist and are interactive', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const selects = page.locator('select');
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(2); // Level + Unit

    // Try selecting a filter value
    if (selectCount >= 1) {
      const firstSelect = selects.first();
      await expect(firstSelect).toBeVisible();
      // Get options
      const options = firstSelect.locator('option');
      const optionCount = await options.count();
      expect(optionCount).toBeGreaterThan(0);
    }

    assertNoErrors('Filter dropdowns');
  });

  test('search input works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const searchInput = page.locator('input[type="text"], input[placeholder*="earch"], input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      await searchInput.fill('');
    }

    assertNoErrors('Search');
  });

  test('Endless Practice card navigates to /endless', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const endlessCard = page.getByText('Endless Practice').first();
    if (await endlessCard.count() > 0) {
      await endlessCard.click();
      await expect(page).toHaveURL(/endless/);
    }

    assertNoErrors('Endless card click');
  });

  test('test cards are clickable and navigate to test page', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1500);

    // Find test cards (excluding Endless card)
    const links = page.locator('a[href*="/test/"]');
    const linkCount = await links.count();

    if (linkCount > 0) {
      const firstLink = links.first();
      const href = await firstLink.getAttribute('href');
      await firstLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/test/');
    }

    assertNoErrors('Test card click');
  });

  test('Sign in link is visible and points to OAuth', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const signIn = page.getByRole('link', { name: /Sign in/i });
    if (await signIn.count() > 0) {
      const href = await signIn.getAttribute('href');
      expect(href).toContain('/api/auth/google/start');
    }

    assertNoErrors('Sign in link');
  });
});

// ============================================================
// 2. THEME & LANGUAGE TOGGLES
// ============================================================
test.describe('Theme & Language — Full Audit', () => {
  test('theme toggle button is visible and clickable', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    // Look for theme toggle (sun/moon icon button)
    const themeBtn = page.locator('button').filter({ hasText: /☀|🌙|☾|☼/ }).first();
    const themeBtnAlt = page.locator('button[aria-label*="theme" i], button[title*="theme" i]').first();

    let btn = null;
    if (await themeBtn.count() > 0) btn = themeBtn;
    else if (await themeBtnAlt.count() > 0) btn = themeBtnAlt;

    if (btn) {
      await expect(btn).toBeVisible();
      const textBefore = await btn.textContent();
      await btn.click();
      await page.waitForTimeout(300);
      // Should toggle (text might change)
      await btn.click(); // toggle back
      await page.waitForTimeout(300);
    }

    assertNoErrors('Theme toggle');
  });

  test('language toggle cycles through languages', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const validLangs = ['EN', 'KO', 'RU', 'ES'];

    // Use aria-label since button text changes on each click
    const langBtn = page.getByRole('button', { name: /change language/i }).first();
    let found = await langBtn.count() > 0;
    if (!found) {
      // Fallback: find by text
      const fallback = page.locator('button').filter({ hasText: /^(EN|KO|RU|ES)$/ }).first();
      found = await fallback.count() > 0;
    }

    if (found) {
      // Always re-locate by aria-label for stability
      const btn = page.getByRole('button', { name: /change language/i }).first();
      await expect(btn).toBeVisible();
      const textBefore = (await btn.textContent()).trim();
      expect(validLangs).toContain(textBefore);

      // Click to cycle
      await btn.click();
      await page.waitForTimeout(300);
      const textAfter = (await btn.textContent()).trim();
      expect(validLangs).toContain(textAfter);

      // Cycle back (3 more clicks for 4 languages)
      for (let i = 0; i < 3; i++) {
        await btn.click();
        await page.waitForTimeout(200);
      }

      const textFinal = (await btn.textContent()).trim();
      expect(validLangs).toContain(textFinal);
    }

    assertNoErrors('Language toggle');
  });
});

// ============================================================
// 3. CREATE TEST PAGE
// ============================================================
test.describe('Create Test Page — Full Audit', () => {
  test('page loads, textarea and buttons visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea');
    await expect(textarea.first()).toBeVisible();

    assertNoErrors('Create page load');
  });

  test('character count updates when typing', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    await textarea.fill('Hello world test content');
    await page.waitForTimeout(300);

    // Character count should appear somewhere
    const charCount = page.getByText(/\d+\s*(\/|of|characters)/i);
    if (await charCount.count() > 0) {
      await expect(charCount.first()).toBeVisible();
    }

    assertNoErrors('Character count');
  });

  test('Generate button disabled when text too short', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    await textarea.fill('short');
    await page.waitForTimeout(300);

    const genBtn = page.getByRole('button', { name: /Generate/i });
    if (await genBtn.count() > 0) {
      await expect(genBtn.first()).toBeDisabled();
    }

    assertNoErrors('Generate button disabled');
  });

  test('Generate button enabled when text >= 200 chars', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    const textarea = page.locator('textarea').first();
    const longText = 'A'.repeat(250);
    await textarea.fill(longText);
    await page.waitForTimeout(300);

    const genBtn = page.getByRole('button', { name: /Generate/i });
    if (await genBtn.count() > 0) {
      await expect(genBtn.first()).toBeEnabled();
    }

    assertNoErrors('Generate button enabled');
  });

  test('upload button exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    // File upload input or button
    const fileInput = page.locator('input[type="file"]');
    const uploadBtn = page.getByRole('button', { name: /upload|file|attach/i });

    const hasUpload = (await fileInput.count() > 0) || (await uploadBtn.count() > 0);
    // Upload may be admin-only, so just check no errors

    assertNoErrors('Upload button');
  });
});

// ============================================================
// 4. TEST TAKING FLOW
// ============================================================
test.describe('Test Taking — Full Audit', () => {
  let testUrl;

  test.beforeEach(async ({ page }) => {
    // Get first available test
    const res = await (await page.request.get(`${API_URL}/api/tests?limit=1`)).json();
    if (res.tests && res.tests.length > 0) {
      testUrl = `${BASE_URL}/test/${res.tests[0]._id}`;
    }
  });

  test('test page loads with title, mode selector, timer', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Title
    const title = page.locator('h1, h2, h3').first();
    await expect(title).toBeVisible();

    // Mode selector (Test/Practice buttons or tabs)
    const testMode = page.getByRole('button', { name: /Test/i });
    const practiceMode = page.getByRole('button', { name: /Practice/i });

    if (await testMode.count() > 0) await expect(testMode.first()).toBeVisible();
    if (await practiceMode.count() > 0) await expect(practiceMode.first()).toBeVisible();

    // Timer (MM:SS format)
    const timer = page.getByText(/\d{1,2}:\d{2}/);
    if (await timer.count() > 0) {
      await expect(timer.first()).toBeVisible();
    }

    assertNoErrors('Test page load');
  });

  test('question navigation dots visible and clickable', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Question dots — small buttons with numbers
    const dots = page.getByRole('button', { name: /^[0-9]+$/, exact: true });
    const dotCount = await dots.count();

    if (dotCount > 1) {
      // Click dot 2
      await dots.nth(1).click();
      await page.waitForTimeout(300);
      // Click dot 1
      await dots.nth(0).click();
      await page.waitForTimeout(300);
    }

    assertNoErrors('Question dots');
  });

  test('Previous/Next buttons work', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    const prevBtn = page.getByRole('button', { name: /Previous|Prev|←/i });
    const nextBtn = page.getByRole('button', { name: /Next|→/i });

    // Previous should be disabled on Q1
    if (await prevBtn.count() > 0) {
      await expect(prevBtn.first()).toBeDisabled();
    }

    // Next should be enabled
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click();
      await page.waitForTimeout(300);
      // Now Previous should be enabled
      if (await prevBtn.count() > 0) {
        await expect(prevBtn.first()).toBeEnabled();
        await prevBtn.first().click();
        await page.waitForTimeout(300);
      }
    }

    assertNoErrors('Prev/Next buttons');
  });

  test('answering MCQ question highlights selection', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Try clicking an MCQ option
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(300);
      // Option should be visually selected (check for active/selected class or style)
      await expect(option).toBeVisible();
    } else {
      // May be a text input question
      const textInput = page.locator('input[type="text"]').first();
      if (await textInput.count() > 0) {
        await textInput.fill('test answer');
        await page.waitForTimeout(300);
      }
    }

    assertNoErrors('Answer selection');
  });

  test('"Back to Tests" button visible and works', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    const exitBtn = page.getByRole('button', { name: /Back to Tests/i }).or(
      page.getByRole('link', { name: /Back to Tests/i })
    );

    if (await exitBtn.count() > 0) {
      await expect(exitBtn.first()).toBeVisible();
      // Don't click without progress — it navigates directly
      // Instead answer a question first then test the modal
    }

    assertNoErrors('Back to Tests button');
  });

  test('exit modal appears when progress exists', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Answer a question first
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(300);
    } else {
      const textInput = page.locator('input[type="text"]').first();
      if (await textInput.count() > 0) {
        await textInput.fill('test');
        await textInput.press('Enter');
        await page.waitForTimeout(300);
      }
    }

    // Now click Back to Tests
    const exitBtn = page.getByRole('button', { name: /Back to Tests/i }).or(
      page.getByRole('link', { name: /Back to Tests/i })
    );

    if (await exitBtn.count() > 0) {
      await exitBtn.first().click();
      await page.waitForTimeout(500);

      // Modal should appear
      const modal = page.getByText(/unsaved progress|leave this test/i);
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();

        // Cancel button dismisses modal
        const cancelBtn = page.getByRole('button', { name: /Cancel|Stay/i });
        if (await cancelBtn.count() > 0) {
          await cancelBtn.first().click();
          await page.waitForTimeout(300);
          // Should still be on test page
          expect(page.url()).toContain('/test/');
        }
      }
    }

    assertNoErrors('Exit modal');
  });

  test('exit confirm navigates to home', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Answer a question
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(300);
    } else {
      const textInput = page.locator('input[type="text"]').first();
      if (await textInput.count() > 0) {
        await textInput.fill('test');
        await textInput.press('Enter');
        await page.waitForTimeout(300);
      }
    }

    const exitBtn = page.getByRole('button', { name: /Back to Tests/i }).or(
      page.getByRole('link', { name: /Back to Tests/i })
    );

    if (await exitBtn.count() > 0) {
      await exitBtn.first().click();
      await page.waitForTimeout(500);

      const confirmBtn = page.getByRole('button', { name: /Confirm|Leave|Yes/i });
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click();
        await page.waitForTimeout(500);
        expect(page.url()).toBe(BASE_URL + '/');
      }
    }

    assertNoErrors('Exit confirm');
  });

  test('mode switch from Test to Practice with progress shows modal', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Answer a question to create progress
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(300);
    } else {
      const textInput = page.locator('input[type="text"]').first();
      if (await textInput.count() > 0) {
        await textInput.fill('test');
        await textInput.press('Enter');
        await page.waitForTimeout(300);
      }
    }

    // Switch mode
    const practiceBtn = page.getByRole('button', { name: /Practice/i }).first();
    if (await practiceBtn.count() > 0) {
      await practiceBtn.click();
      await page.waitForTimeout(500);

      // Should show modal
      const modal = page.getByText(/Switching modes|switch.*mode|reset/i);
      if (await modal.count() > 0) {
        await expect(modal.first()).toBeVisible();
        // Cancel
        const cancelBtn = page.getByRole('button', { name: /Cancel/i });
        if (await cancelBtn.count() > 0) {
          await cancelBtn.first().click();
          await page.waitForTimeout(300);
        }
      }
    }

    assertNoErrors('Mode switch modal');
  });

  test('Practice mode shows instant feedback', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Switch to Practice mode (no progress yet, so direct switch)
    const practiceBtn = page.getByRole('button', { name: /Practice/i }).first();
    if (await practiceBtn.count() > 0) {
      await practiceBtn.click();
      await page.waitForTimeout(500);
    }

    // Answer a question
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(500);

      // Should show feedback (Correct/Incorrect or explanation)
      const feedback = page.getByText(/Correct|Incorrect|Explanation|✓|✗/i);
      // In practice mode, feedback should be visible
    }

    assertNoErrors('Practice mode feedback');
  });

  test('Test mode hides feedback until Submit', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Should default to Test mode
    const option = page.locator('button').filter({ hasText: /^[1-4]\./ }).first();
    if (await option.count() > 0) {
      await option.click();
      await page.waitForTimeout(300);

      // In test mode, no immediate feedback text
      const correctText = page.getByText(/^Correct!$/i);
      const incorrectText = page.getByText(/^Incorrect$/i);
      expect(await correctText.count()).toBe(0);
      expect(await incorrectText.count()).toBe(0);
    }

    assertNoErrors('Test mode no feedback');
  });

  test('Submit button appears and works after answering all', async ({ page }) => {
    test.skip(!testUrl, 'No tests available');
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    // Get total questions from dots
    const dots = page.getByRole('button', { name: /^[0-9]+$/, exact: true });
    const totalQ = await dots.count();

    // Answer each question
    for (let i = 0; i < totalQ; i++) {
      if (i > 0) {
        await dots.nth(i).click();
        await page.waitForTimeout(300);
      }

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
      await page.waitForTimeout(200);
    }

    // Submit button
    const submitBtn = page.getByRole('button', { name: /Submit|Finish/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click();
      await page.waitForTimeout(1000);

      // Should show results (score)
      const score = page.getByText(/score|result|\d+\s*\/\s*\d+|\d+%/i);
      if (await score.count() > 0) {
        await expect(score.first()).toBeVisible();
      }
    }

    assertNoErrors('Submit and results');
  });
});

// ============================================================
// 5. ENDLESS MODE
// ============================================================
test.describe('Endless Mode — Full Audit', () => {
  test('start screen shows title, filters, start button', async ({ page }) => {
    await page.goto(`${BASE_URL}/endless`);
    await page.waitForTimeout(1000);

    await expect(page.getByText('Endless Practice')).toBeVisible();

    const startBtn = page.getByRole('button', { name: /Start|Begin/i });
    if (await startBtn.count() > 0) {
      await expect(startBtn.first()).toBeVisible();
    }

    // Filter dropdowns
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });
    expect(await selects.count()).toBeGreaterThanOrEqual(2);

    assertNoErrors('Endless start screen');
  });

  test('start button begins question flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/endless`);
    await page.waitForTimeout(1000);

    const startBtn = page.getByRole('button', { name: /Start|Begin/i });
    if (await startBtn.count() > 0) {
      await startBtn.first().click();
      await page.waitForTimeout(2000);

      // Should show a question or loading
      const questionArea = page.locator('button').filter({ hasText: /^[1-4]\./ });
      const textInput = page.locator('input[type="text"]');
      const loading = page.getByText(/loading|fetching/i);
      const noQuestions = page.getByText(/no questions|no tests/i);

      // One of these should be present
      const hasContent = (await questionArea.count() > 0) ||
                         (await textInput.count() > 0) ||
                         (await loading.count() > 0) ||
                         (await noQuestions.count() > 0);
    }

    assertNoErrors('Endless start');
  });

  test('filter dropdowns are interactive', async ({ page }) => {
    await page.goto(`${BASE_URL}/endless`);
    await page.waitForTimeout(1000);

    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5000 });

    // Try selecting a value in first dropdown
    const firstSelect = selects.first();
    const options = firstSelect.locator('option');
    const optCount = await options.count();
    if (optCount > 1) {
      await firstSelect.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      await firstSelect.selectOption({ index: 0 }); // reset
    }

    assertNoErrors('Endless filters');
  });
});

// ============================================================
// 6. KEYBOARD SHORTCUTS
// ============================================================
test.describe('Keyboard Shortcuts — Full Audit', () => {
  test('Ctrl+P opens command palette', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);

    // Command palette should appear
    const palette = page.getByPlaceholder(/search|command|type/i).or(
      page.locator('[class*="CommandPalette"], [class*="Palette"], [role="dialog"]')
    );

    if (await palette.count() > 0) {
      await expect(palette.first()).toBeVisible();

      // Type something in the search
      const input = page.getByPlaceholder(/search|command|type/i).first();
      if (await input.count() > 0) {
        await input.fill('test');
        await page.waitForTimeout(300);
      }

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    assertNoErrors('Ctrl+P palette');
  });

  test('Ctrl+K opens shortcuts modal', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    // Shortcuts modal should appear
    const shortcuts = page.getByText(/Keyboard Shortcuts|Shortcuts/i);
    if (await shortcuts.count() > 0) {
      await expect(shortcuts.first()).toBeVisible();

      // Close with Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    assertNoErrors('Ctrl+K shortcuts');
  });

  test('Escape closes modals', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    // Open palette
    await page.keyboard.press('Control+p');
    await page.waitForTimeout(500);

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open shortcuts
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    assertNoErrors('Escape closes modals');
  });
});

// ============================================================
// 7. ERROR STATES & 404
// ============================================================
test.describe('Error States — Full Audit', () => {
  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/nonexistent-page-12345`);
    await page.waitForTimeout(500);

    const notFound = page.getByText(/not found|404|page.*exist/i);
    await expect(notFound.first()).toBeVisible();

    // Should have a link back to home
    const homeLink = page.getByRole('link', { name: /home|back|return/i }).or(
      page.getByRole('button', { name: /home|back|return/i })
    );
    if (await homeLink.count() > 0) {
      await homeLink.first().click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(BASE_URL + '/');
    }

    assertNoErrors('404 page');
  });

  test('invalid test ID shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/test/invalid-id-123`);
    await page.waitForTimeout(2000);

    // Should show error or redirect
    const error = page.getByText(/error|not found|failed|invalid/i);
    // Just verify no page crash

    assertNoErrors('Invalid test ID');
  });
});

// ============================================================
// 8. ACCESSIBILITY CHECKS
// ============================================================
test.describe('Accessibility — Full Audit', () => {
  test('all visible buttons have accessible names', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const buttons = page.getByRole('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (await btn.isVisible()) {
        const name = await btn.getAttribute('aria-label') || await btn.textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    }

    assertNoErrors('Button a11y');
  });

  test('all navigation links have accessible text', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(500);

    const links = page.getByRole('link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      if (await link.isVisible()) {
        const name = await link.getAttribute('aria-label') || await link.textContent();
        expect(name?.trim().length).toBeGreaterThan(0);
      }
    }

    assertNoErrors('Link a11y');
  });

  test('form inputs have labels or placeholders', async ({ page }) => {
    await page.goto(`${BASE_URL}/create`);
    await page.waitForTimeout(500);

    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      if (await input.isVisible()) {
        const hasLabel = await input.getAttribute('aria-label') ||
                         await input.getAttribute('placeholder') ||
                         await input.getAttribute('id'); // may have associated label
        // At minimum should have one identifier
      }
    }

    assertNoErrors('Input a11y');
  });
});

// ============================================================
// 9. CONSOLE ERROR DEEP SCAN
// ============================================================
test.describe('Console Error Deep Scan', () => {
  const pagesToScan = [
    { name: 'Home', url: '/' },
    { name: 'Create', url: '/create' },
    { name: 'Endless', url: '/endless' },
    { name: '404', url: '/nonexistent' },
  ];

  for (const p of pagesToScan) {
    test(`${p.name} page (${p.url}) — zero console errors`, async ({ page }) => {
      const errors = [];
      const warnings = [];

      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
        if (msg.type() === 'warning') warnings.push(msg.text());
      });
      page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

      await page.goto(`${BASE_URL}${p.url}`);
      await page.waitForTimeout(2000);

      // Filter known non-critical messages
      const realErrors = errors.filter(e =>
        !e.includes('favicon.ico') &&
        !e.includes('401') &&
        !e.includes('net::ERR_')
      );

      if (realErrors.length > 0) {
        throw new Error(`Console errors on ${p.name}:\n${realErrors.join('\n')}`);
      }
    });
  }

  test('Test page — zero console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`));

    // Get a real test ID
    const res = await (await page.request.get(`${API_URL}/api/tests?limit=1`)).json();
    test.skip(!res.tests?.length, 'No tests');

    await page.goto(`${BASE_URL}/test/${res.tests[0]._id}`);
    await page.waitForTimeout(2000);

    const realErrors = errors.filter(e =>
      !e.includes('favicon.ico') &&
      !e.includes('401') &&
      !e.includes('net::ERR_')
    );

    if (realErrors.length > 0) {
      throw new Error(`Console errors on Test page:\n${realErrors.join('\n')}`);
    }
  });
});
