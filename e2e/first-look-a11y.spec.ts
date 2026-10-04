import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { TAGS } from './gate';

/**
 * WCAG gate for the beginner front-section at the three widths the catalog
 * checks: desktop, phone, and the 320px floor WCAG 1.4.10 reflow is measured
 * at. The host lab's own suite covers its twenty-eight exhibit states; this
 * covers the section added in front of them, in every state it can reach.
 */
const WIDTHS = [
  { label: '1280px', width: 1280, height: 900 },
  { label: '390px', width: 390, height: 844 },
  { label: '320px', width: 320, height: 800 },
];

for (const vp of WIDTHS) {
  test(`front-section: no WCAG A/AA violations at ${vp.label}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('./');

    const scan = async (label: string) => {
      const res = await new AxeBuilder({ page }).include('#first-look').withTags(TAGS).analyze();
      expect(
        res.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        `axe violations at ${vp.label}: ${label}`,
      ).toEqual([]);
    };

    await scan('initial');
    await page.locator('#fl-hide').click();
    await expect(page.locator('#fl-look-status')).toHaveAttribute('data-outcome', 'CHANGED');
    await scan('hidden');
    await page.locator('#fl-extract').click();
    await expect(page.locator('#fl-recovered')).toHaveAttribute('data-outcome', 'MATCH');
    await scan('extracted');
    await page.locator('#fl-detect').click();
    await expect(page.locator('#fl-detect-stego')).toHaveAttribute('data-outcome', 'CLEAN');
    await scan('checked');
    await page.locator('#fl-fill').click();
    await expect(page.locator('#fl-detect-filled')).toHaveAttribute('data-outcome', 'FLAGGED', { timeout: 30_000 });
    await scan('filled');

    // Open both disclosures: the statistic text is a state the scans above
    // never reach, and it is where the only dense text in the section lives.
    for (const d of await page.locator('#first-look details summary').all()) {
      await d.click();
    }
    await scan('disclosures open');

    // WCAG 1.4.10: the section must not force horizontal scrolling at any of
    // the three widths, with the two 256px canvases in it.
    const overflow = await page.evaluate(() => {
      const s = document.querySelector('#first-look') as HTMLElement;
      return { el: s.scrollWidth - s.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(overflow.el, `section overflow at ${vp.label}`).toBeLessThanOrEqual(1);
    expect(overflow.doc, `page overflow at ${vp.label}`).toBeLessThanOrEqual(1);
  });
}
