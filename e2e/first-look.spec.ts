import { expect, test, type Page } from '@playwright/test';

/**
 * §4.1b claims gate for the beginner front-section.
 *
 * Each of the five rendered verdicts is driven through its real button and
 * asserted from the `data-outcome` the page computed, never from the sentence
 * it printed. `scripts/mutate.mjs` replays one source patch per verdict against
 * the test named beside it here.
 */

const SECRET = 'Meet me at the library at four.';

async function hide(page: Page): Promise<void> {
  await page.goto('./');
  await page.locator('#fl-hide').click();
  await expect(page.locator('#fl-look-status')).toHaveAttribute('data-outcome', 'CHANGED');
}

test('step 1: hiding the sentence really changes the picture', async ({ page }) => {
  await hide(page);
  // The count is the claim, so it is read back and checked as a number.
  const text = await page.locator('#fl-look-status').innerText();
  const changed = Number(text.replace(/,/g, '').match(/^(\d+)/)?.[1] ?? '0');
  expect(changed).toBeGreaterThan(0);
  expect(changed).toBeLessThan(256 * 256);
});

test('step 3: the sentence comes back out of the picture', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-extract').click();
  await expect(page.locator('#fl-recovered')).toHaveAttribute('data-outcome', 'MATCH');
  await expect(page.locator('#fl-recovered')).toContainText(SECRET);
});

test('step 3 control: the same read of the untouched original returns nothing', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-extract').click();
  await expect(page.locator('#fl-control')).toHaveAttribute('data-outcome', 'NOTHING');
  await expect(page.locator('#fl-control')).not.toContainText(SECRET);
});

test('step 4: the detector reports nothing found on both pictures', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-detect').click();
  await expect(page.locator('#fl-detect-cover')).toHaveAttribute('data-outcome', 'CLEAN');
  await expect(page.locator('#fl-detect-stego')).toHaveAttribute('data-outcome', 'CLEAN');
});

test('step 5: filling the picture to capacity IS reported', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-detect').click();
  await page.locator('#fl-fill').click();
  await expect(page.locator('#fl-detect-filled')).toHaveAttribute('data-outcome', 'FLAGGED', { timeout: 30_000 });
});

/**
 * §4.1d, in the browser. The section shows a carrier the detector calls clean
 * while the reader has already read the message back out of it. Both halves of
 * that contradiction are asserted on one page, in one run, so the section
 * cannot show step 4 without step 3 standing beside it.
 */
test('a clean result is not proof that nothing is hidden', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-extract').click();
  await expect(page.locator('#fl-recovered')).toHaveAttribute('data-outcome', 'MATCH');
  await page.locator('#fl-detect').click();
  await expect(page.locator('#fl-detect-stego')).toHaveAttribute('data-outcome', 'CLEAN');
});

test('no hex, bit planes or statistics surface in the section itself', async ({ page }) => {
  await hide(page);
  await page.locator('#fl-extract').click();
  await page.locator('#fl-detect').click();
  const section = page.locator('#first-look');
  // The statistic lives behind the two disclosures, which ship closed.
  await expect(page.locator('#first-look details[open]')).toHaveCount(0);
  await expect(section).not.toContainText(/chi-squared|χ²|p-value|bits per pixel|bpp/i);
});
