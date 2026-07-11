import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Strict WCAG regression gate for the Stego Suite demo.
 *
 * The app is a single page rendered by main.ts with six exhibits. Several
 * exhibits inject their result/status regions only after a "run" button is
 * clicked (LSB embed/extract, chi-squared, DCT transform, adaptive embedding).
 * So we DRIVE every live demo before scanning so the dynamically-injected
 * output regions are in the DOM and rendered when axe runs.
 *
 * There are no <details> here (collapsibles are class-toggled), but we still
 * generically expand any collapsibles for robustness. Scans both themes with
 * WCAG 2.0/2.1 A + AA rules; asserts zero violations.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Neutralize animation/transition/opacity so mid-flight states can't hide text
// from the contrast checker.
async function killMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{
      animation-duration:0s!important;animation-delay:0s!important;
      transition-duration:0s!important;transition-delay:0s!important;
      opacity:1!important;scroll-behavior:auto!important;
    }`,
  });
}

// Force any collapsibles / hidden panels into the visible tree.
async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) (d as HTMLDetailsElement).open = true;
    for (const el of document.querySelectorAll<HTMLElement>('[hidden]')) el.removeAttribute('hidden');
  });
}

// Drive every live demo so injected output regions exist during the scan.
async function driveDemos(page: Page): Promise<void> {
  // Exhibit 2 — LSB embed round-trip.
  await page.locator('#lsb-message').fill('accessibility gate payload');
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('PSNR', { timeout: 15_000 });
  await page.locator('#lsb-extract').click();

  // Exhibit 3 — chi-squared steganalysis (needs an embed first, done above).
  await page.locator('#chi-test-cover').click();
  await page.locator('#chi-test-stego').click();
  await page.locator('#chi-run-curve').click();
  await expect(page.locator('#chi-curve table')).toBeVisible({ timeout: 15_000 });

  // Exhibit 4 — DCT workflow.
  await page.locator('#dct-transform').click();
  await page.locator('#dct-embed').click();
  await page.locator('#dct-inverse').click();
  await page.locator('#dct-extract').click();
  await expect(page.locator('#dct-stats')).toContainText('Recovered', { timeout: 15_000 });

  // Exhibit 5 — adaptive embedding and comparison.
  await page.locator('#adapt-map').click();
  await page.locator('#adapt-embed').click();
  await page.locator('#adapt-seq').click();
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('texture', { timeout: 15_000 });
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#cl-theme-toggle')).toBeVisible();
  await expect(page.locator('#exhibit-1')).toBeVisible();
  await killMotion(page);
});

test('no WCAG A/AA violations in dark theme (all demos driven)', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await driveDemos(page);
  await killMotion(page);
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme (all demos driven)', async ({ page }) => {
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await driveDemos(page);
  await killMotion(page);
  await revealAll(page);
  await scan(page);
});
