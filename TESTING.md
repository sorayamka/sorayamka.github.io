# Functional browser testing

The tester is Playwright using desktop Chromium and mobile Chromium emulation,
with isolated browser storage for each test. Tests do not submit orders or send
messages to the sales team. Phone, email, Telegram and PDF links are checked as
resources rather than contacted as customers.

## Local production build

```powershell
npm run build
npm run test:e2e
```

If build output is on another drive:

```powershell
$env:TEST_OUT_DIR = 'D:\site-dist'
npm run test:e2e
```

## Published site

```powershell
$env:TEST_BASE_URL = 'https://sorayamka.github.io'
npm run test:e2e
```

With TEST_BASE_URL set, Playwright does not start a local server. Unset that
variable to return to local testing. The existing server on port 4321 is reused;
ensure it serves the intended production build.

## Reports

```powershell
npx playwright show-report
```

The HTML report is saved in playwright-report. Failed tests retain screenshots
and Playwright traces in test-results. On Windows the configuration uses the
installed Google Chrome; elsewhere install the Playwright Chromium browser.

## Coverage

- RU/EN search, categories, subcategories, sorting, no-results and reset.
- Last-page navigation, previous page, history and reload restoration.
- Product add, repeated add, quantity validation and cart persistence.
- Decrease from two to one, cancel/accept item removal and cart clearing.
- Downloaded shopping-list content and filename.
- Recovery from invalid saved cart JSON.
- Desktop search and dropdown navigation, mobile menu focus and navigation.
- Ticker pause/resume, search keyboard shortcut and cart Escape dismissal.
- Weekly prices, product links, PDF documents and contact links.
- Locale alternates, structured data and common viewport widths.
- Cross-tab cart synchronization and cancellation of cart clearing.
- Saved filter URLs, name ordering and category reset to all 1,120 products.
- Catalog index network failure, locale-preserving product navigation and 404s.
- Full-width hero and actual 800/1600/3840 px responsive AVIF selection.

Latest local run: 69 passed, 5 device-specific skips. Fixed defects: decreasing
two units to one previously removed the item; reset left the selected category
active on the main catalog. Removed unstable cross-document View Transitions
that emitted Chrome invalid-state exceptions during normal navigation.

This is not exhaustive coverage of every product or every browser. Mobile tests
are device emulation, not physical iPhone/Safari testing. External applications,
real customer message delivery and server-side order processing are not tested.
Live testing is blocked while the repository's Pages endpoint returns HTTP 404.
