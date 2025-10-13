# StreamGo E2E Tests

End-to-end tests for StreamGo using Playwright.

## Setup

Tests are automatically configured via `playwright.config.ts` in the project root.

### Installation

Playwright is already installed as a dev dependency. To install browser binaries:

```bash
npx playwright install
```

## Running Tests

### Run all tests (headless)
```bash
npm run test:e2e
```

### Run tests with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### View test report
```bash
npm run test:e2e:report
```

### Run specific test file
```bash
npx playwright test tests/e2e/app.spec.ts
```

### Run tests in headed mode
```bash
npx playwright test --headed
```

### Debug tests
```bash
npx playwright test --debug
```

## Test Structure

### `app.spec.ts`
Core application tests covering:
- App loading and sidebar display
- Navigation between views
- Search functionality
- Player container presence

### `library.spec.ts`
Library features tests covering:
- Watchlist view
- Favorites view
- Continue watching view
- Library view
- Detail page action buttons

### `player.spec.ts`
Video player tests covering:
- Player container and controls
- Quality selector
- Subtitle controls
- Play/pause functionality
- Volume controls
- Progress bar
- Fullscreen support
- Close button
- Keyboard shortcuts support

## Test Configuration

The Playwright config (`playwright.config.ts`) is set up to:
- Run tests from `./tests/e2e` directory
- Use Chromium browser
- Start the dev server automatically before tests
- Use `http://localhost:1420` as base URL (Tauri default)
- Enable traces on first retry
- Run with retries in CI environment

## Writing New Tests

When adding new tests:
1. Create a new `.spec.ts` file in `tests/e2e/`
2. Import test utilities: `import { test, expect } from '@playwright/test';`
3. Use `test.describe()` blocks to group related tests
4. Use `test.beforeEach()` for common setup
5. Follow existing patterns for consistency

Example:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should do something', async ({ page }) => {
    // Your test here
  });
});
```

## CI Integration

E2E tests can be added to the CI pipeline in `.github/workflows/ci.yml` by adding:

```yaml
- name: Install Playwright Browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E Tests
  run: npm run test:e2e
```

## Notes

- Tests assume the Tauri app is running on `http://localhost:1420`
- The dev server is automatically started by Playwright before tests run
- Some tests check for DOM element presence rather than full interactions (especially for features requiring real media data)
- Keyboard shortcut tests are placeholders and would benefit from actual media playback mocking in future iterations
