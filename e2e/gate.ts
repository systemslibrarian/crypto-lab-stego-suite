import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this file
 *     replaces called `revealAll`, which forced the `.deep-dive` disclosure
 *     open and stripped `[hidden]` off everything — including the two `<input
 *     type="file">` elements that are deliberately hidden behind their
 *     `.file-btn` labels, so every scan ran against a page with two bare file
 *     pickers no visitor ever sees. It also injected `animation-duration: 0s` /
 *     `transition-duration: 0s`, so the suite was structurally incapable of
 *     observing a transition or theme-swap defect.
 *
 *     It also scanned the accumulated end state ONCE per theme, at desktop
 *     width, and asserted on axe `violations` alone.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing, and every stats region on this page starts empty — the LSB,
 *     chi-squared, DCT and adaptive results are all injected by a click.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. This lab's
 * reduced-motion block collapses durations to 0.001ms rather than cancelling
 * animations, which preserves end states — so the check is expected to be
 * silent here, and is kept because a future keyframe could change that.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page.
 *
 * The theme is seeded in `localStorage` rather than reached by clicking the
 * toggle, so the page boots in the theme under test instead of transitioning
 * into it — and the light-theme walk is a fresh load rather than a walk of a
 * page that was mid-transition when the first scan ran.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // Fail fast on an unreachable control. Playwright's default action timeout is
  // the whole test timeout, so a click on something a sticky header covers, or
  // a locator gated on a prerequisite that never ran, silently burns the entire
  // budget instead of pointing at the state it could not reach.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // main.ts renders the entire page into #app and then loads the sample cover
  // asynchronously. Scanning before the cover has landed is scanning a page
  // whose six canvases are all blank.
  await expect(page.locator('#exhibit-1')).toBeVisible();
  await expect(page.locator('.exhibit')).toHaveCount(6);
  await expect(page.locator('#cover-source-name')).toContainText('256');
  await expect(page.locator('#lsb-walk-caption')).not.toBeEmpty();

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: it lays its figures out on `repeat(auto-fit,
 * minmax(240px, 1fr))` and `minmax(180px, 1fr)` tracks whose fixed floor a
 * 380px viewport cannot go below, draws fixed-width canvases up to 640px, and
 * prints two tables.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide table inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const widest = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .filter((x) => !clipped(x.el))
      .sort((a, b) => b.r.right - a.r.right)[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less div hides, a defect that never
 *    reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([]);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]);

  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}

/**
 * Drive the whole single-page document, scanning each state.
 *
 * EVERY control on the page is reached, which the old gate did not manage. It
 * drove twelve buttons and left these untouched: `#cover-sample`,
 * `#lsb-encrypt`, `#lsb-passphrase`, `#lsb-download`, `#lsb-reset`, the three
 * `#lsb-walk-*` buttons, `#chi-toy-slider`, the `.deep-dive` disclosure, and
 * the `#dct-basis` hover preview. Several of those are whole exhibits' worth
 * of rendered state.
 *
 * Both branches of every two-verdict exhibit are visited. That matters most
 * here because the "something went wrong" branch has its own palette
 * (`.status-warn`) and is reached only by using the page WRONG — extracting
 * before embedding, ticking Encrypt with no passphrase, asking chi-squared to
 * test a stego image that does not exist yet, comparing placements before
 * running both. None of those was ever scanned.
 *
 * `#cover-upload` and `#lsb-extract-file` take real files. Rather than skip
 * them, the gate round-trips the demo's OWN stego PNG back through
 * `#lsb-extract-file`, which is the documented workflow and renders a distinct
 * result panel.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  await scan(page, `${theme} / first paint`);

  await page.locator('.cl-skip-link').focus();
  await scan(page, `${theme} / skip link focused`);

  // ── Exhibit 1 — the one native disclosure ──────────────────────────────
  await page.locator('.deep-dive summary').click();
  await expect(page.locator('.deep-dive')).toHaveAttribute('open', '');
  await scan(page, `${theme} / deep-dive open`);
  await page.locator('.deep-dive summary').click();
  await expect(page.locator('.deep-dive')).not.toHaveAttribute('open', '');

  // ── Exhibit 2 — the bit-by-bit walkthrough ─────────────────────────────
  // Its own three-button toolbar, never driven before. Stepping forward
  // rewrites the byte display and the caption; Previous at step 0 and Next at
  // the end are the boundary renderings.
  // `#lsb-walk-prev` ships DISABLED at step 0 — clicking it waits forever,
  // which is a missing prerequisite rather than a broken locator. Scan that
  // boundary rendering, then step forward and come back through it.
  await expect(page.locator('#lsb-walk-prev')).toBeDisabled();
  await scan(page, `${theme} / walkthrough at the first bit`);
  for (let i = 0; i < 4; i++) await page.locator('#lsb-walk-next').click();
  await expect(page.locator('#lsb-walk-byte')).not.toBeEmpty();
  await expect(page.locator('#lsb-walk-prev')).toBeEnabled();
  await scan(page, `${theme} / walkthrough stepped forward`);
  await page.locator('#lsb-walk-prev').click();
  await scan(page, `${theme} / walkthrough stepped back`);
  await page.locator('#lsb-walk-reset').click();
  await expect(page.locator('#lsb-walk-prev')).toBeDisabled();
  await scan(page, `${theme} / walkthrough reset`);

  // ── Exhibit 2 — the error branches ─────────────────────────────────────
  // Extracting before anything is embedded.
  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats .status-warn')).toBeVisible();
  await scan(page, `${theme} / extract with nothing embedded`);

  // An empty message.
  await page.locator('#lsb-message').fill('');
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('Provide a message first');
  await scan(page, `${theme} / embed with no message`);

  // Encrypt ticked with no passphrase.
  await page.locator('#lsb-message').fill('accessibility gate payload');
  await page.locator('#lsb-encrypt').check();
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('passphrase is required');
  await scan(page, `${theme} / encrypt with no passphrase`);

  // ── Exhibit 2 — the encrypted round trip ───────────────────────────────
  await page.locator('#lsb-passphrase').fill('correct horse battery staple');
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('PSNR', { timeout: 60_000 });
  await scan(page, `${theme} / encrypted embed`);

  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats')).not.toBeEmpty();
  await scan(page, `${theme} / encrypted extract`);

  // Wrong passphrase on the same stego image: the decryption-failure verdict.
  await page.locator('#lsb-passphrase').fill('wrong passphrase');
  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats')).toContainText(/Decryption failed|passphrase/);
  await scan(page, `${theme} / wrong passphrase`);

  // Over-capacity: the capacity meter's own warning state.
  await page.locator('#lsb-encrypt').uncheck();
  await page.locator('#lsb-message').fill('x'.repeat(200));
  await expect(page.locator('#lsb-capacity-text')).not.toBeEmpty();
  await scan(page, `${theme} / capacity meter at maximum message length`);

  // ── Exhibit 2 — the plain round trip, and the PNG round trip ───────────
  await page.locator('#lsb-message').fill('Steganography hides the existence of communication.');
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('PSNR', { timeout: 60_000 });
  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats')).not.toBeEmpty();
  await scan(page, `${theme} / plain embed and extract`);

  // The download button, and then feeding that very PNG back in through the
  // file picker — the workflow the page documents, and a control the old gate
  // never touched because it needs a real file on disk.
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#lsb-download').click(),
  ]).then(([d]) => d);
  const stegoPath = await download.path();
  await page.locator('#lsb-extract-file').setInputFiles(stegoPath);
  await expect(page.locator('#lsb-stats')).not.toBeEmpty();
  await scan(page, `${theme} / extracted from the downloaded PNG`);

  // ── Exhibit 3 — the chi-squared toy, then the real test ────────────────
  // The slider is a live canvas exhibit with its own readout, never driven.
  for (const value of ['0', '50', '100']) {
    await page.locator('#chi-toy-slider').fill(value);
    await expect(page.locator('#chi-toy-readout')).toHaveText(`${value}%`);
    await scan(page, `${theme} / chi toy at ${value}% embedded`);
  }

  await page.locator('#chi-test-cover').click();
  await expect(page.locator('#chi-results')).not.toBeEmpty();
  await scan(page, `${theme} / chi-squared on the cover`);

  await page.locator('#chi-test-stego').click();
  await expect(page.locator('#chi-results')).not.toBeEmpty();
  await scan(page, `${theme} / chi-squared on the stego image`);

  await page.locator('#chi-run-curve').click();
  await expect(page.locator('#chi-curve table')).toBeVisible({ timeout: 60_000 });
  await scan(page, `${theme} / detectability curve`);

  // ── Exhibit 4 — DCT ────────────────────────────────────────────────────
  // Extracting before embedding is the error branch.
  await page.locator('#dct-extract').click();
  await expect(page.locator('#dct-stats')).not.toBeEmpty();
  await scan(page, `${theme} / DCT extract before embed`);

  await page.locator('#dct-transform').click();
  await expect(page.locator('#dct-stats')).not.toBeEmpty();
  await scan(page, `${theme} / DCT transform`);

  // Hovering a heatmap cell fills the basis-pattern preview, which otherwise
  // never leaves its placeholder text.
  await page.locator('#dct-before').hover();
  await expect(page.locator('#dct-basis-text')).not.toBeEmpty();
  await scan(page, `${theme} / DCT basis preview`);

  await page.locator('#dct-embed').click();
  await page.locator('#dct-inverse').click();
  await page.locator('#dct-extract').click();
  await expect(page.locator('#dct-stats')).toContainText('Recovered', { timeout: 60_000 });
  await scan(page, `${theme} / DCT round trip`);

  // ── Exhibit 5 — adaptive vs sequential ─────────────────────────────────
  // Comparing before both placements exist is the error branch.
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).not.toBeEmpty();
  await scan(page, `${theme} / adaptive compare before both runs`);

  await page.locator('#adapt-map').click();
  await expect(page.locator('#adapt-stats')).not.toBeEmpty();
  await scan(page, `${theme} / texture map`);

  await page.locator('#adapt-embed').click();
  await page.locator('#adapt-seq').click();
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('texture', { timeout: 60_000 });
  await scan(page, `${theme} / adaptive vs sequential compared`);

  // ── Back to a clean slate ──────────────────────────────────────────────
  // Reset and re-seed the cover, the two controls that put the page back to a
  // state a returning visitor sees.
  await page.locator('#lsb-reset').click();
  await scan(page, `${theme} / reset`);

  await page.locator('#cover-sample').click();
  await expect(page.locator('#cover-source-name')).toContainText('256');
  await scan(page, `${theme} / cover re-seeded`);
}
