import { test } from '@playwright/test';
import { boot, driveAllStates, expectBaselineNotStale, NARROW } from './gate';

/**
 * WCAG A/AA regression gate for the Stego Suite demo.
 *
 * Twenty-eight states per theme at desktop and phone width: the LSB
 * bit-by-bit walkthrough, the encrypted and plain round trips, a PNG
 * round-tripped back through the file picker, the chi-squared toy at three
 * slider positions, the real chi-squared tests and detectability curve, the
 * DCT workflow including the basis-pattern hover, adaptive vs sequential
 * embedding — and the FIVE error verdicts, each of which has its own
 * `.status-warn` palette and is reached only by using the page wrong.
 *
 * See `gate.ts` for why nothing is injected into the page, why each scan
 * asserts its content first, and why `violations` is not the whole oracle.
 */

for (const theme of ['dark', 'light'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
    expectBaselineNotStale();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    expectBaselineNotStale();
  });
}
