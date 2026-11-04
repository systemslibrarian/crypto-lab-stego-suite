import { expect, test, type Page } from '@playwright/test';

/**
 * Carrier survival gate (Exhibit 2, "Does the message survive?").
 *
 * Written before the panel existed, from the ebook review's acceptance points and Wayner's
 * distinction between hiding, detecting and destroying a message: an unchanged PNG reload must
 * recover the message; every transformed carrier reports a measured outcome rather than promised
 * survival; with encryption, a damaged header (carrier failure) is told apart from a ciphertext
 * that survives far enough for AES-GCM to reject it (authentication failure); the detection score
 * is not an extraction probability; in-memory DCT extraction is not a saved-JPEG round trip.
 */

const OUTCOMES = ['Recovered', 'Carrier failure', 'Authentication failure', 'Message altered'];

type Row = { name: string; change: string; bits: string; result: string };

async function embed(page: Page, message: string, passphrase?: string): Promise<void> {
  await page.locator('#lsb-message').fill(message);
  if (passphrase) {
    await page.locator('#lsb-encrypt').check();
    await page.locator('#lsb-passphrase').fill(passphrase);
  }
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('Payload:', { timeout: 30_000 });
}

async function runSurvival(page: Page): Promise<Row[]> {
  await page.locator('#lsb-survival-run').click();
  await expect(page.locator('#lsb-survival-status')).toContainText('Measured', { timeout: 60_000 });
  return page.locator('#lsb-survival-table tbody tr').evaluateAll(rows =>
    rows.map(r => {
      const cells = [...r.querySelectorAll('th, td')].map(c => (c as HTMLElement).innerText.trim());
      return { name: cells[0], change: cells[1], bits: cells[2], result: cells[3].split('\n')[0].trim() };
    }),
  );
}

const wrongBits = (row: Row): number => Number(/^(\d+) of \d+/.exec(row.bits)?.[1] ?? NaN);
const byName = (rows: Row[], prefix: string): Row => {
  const row = rows.find(r => r.name.startsWith(prefix));
  if (!row) throw new Error('No row named ' + prefix);
  return row;
};

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#lsb-embed')).toBeVisible();
});

test('survival: refuses before a message is embedded', async ({ page }) => {
  await page.locator('#lsb-survival-run').click();
  await expect(page.locator('#lsb-survival-status')).toContainText('Embed a message first');
  await expect(page.locator('#lsb-survival-table tbody tr')).toHaveCount(0);
});

test('survival: exact PNG reload recovers the message with no bit errors', async ({ page }) => {
  await embed(page, 'meet at the north gate');
  const row = byName(await runSurvival(page), 'Exact PNG reload');
  expect(row.result).toBe('Recovered');
  expect(wrongBits(row)).toBe(0);
});

test('survival: JPEG re-encoding is measured, not assumed', async ({ page }) => {
  await embed(page, 'meet at the north gate');
  const jpeg = (await runSurvival(page)).filter(r => r.name.startsWith('JPEG'));
  expect(jpeg.map(r => r.name)).toEqual(['JPEG, quality 0.95', 'JPEG, quality 0.75', 'JPEG, quality 0.50']);
  for (const row of jpeg) {
    expect(OUTCOMES).toContain(row.result);
    expect(wrongBits(row)).toBeGreaterThan(0);
    expect(row.change).toMatch(/PSNR \d+(\.\d)? dB/);
  }
});

test('survival: crop, resize and noise each report a measured outcome', async ({ page }) => {
  await embed(page, 'meet at the north gate');
  const rows = await runSurvival(page);
  for (const prefix of ['Crop', 'Resize']) {
    const row = byName(rows, prefix);
    expect(row.change).toContain('→');
    expect(row.result).not.toBe('Recovered');
  }
  const noise = byName(rows, 'Noise');
  expect(noise.change).toMatch(/PSNR \d+(\.\d)? dB/);
  expect(wrongBits(noise)).toBeGreaterThan(0);
  for (const row of rows) expect(OUTCOMES).toContain(row.result);
});

test('survival: an altered ciphertext is an authentication failure, not a carrier failure', async ({ page }) => {
  await embed(page, 'meet at the north gate', 'correct horse battery');
  const rows = await runSurvival(page);
  expect(byName(rows, 'Exact PNG reload').result).toBe('Recovered');
  expect(byName(rows, 'One bit flipped in the packet header').result).toBe('Carrier failure');
  expect(byName(rows, 'One bit flipped in the message body').result).toBe('Authentication failure');
});

test('survival: a body bit flip in a plaintext carrier alters the message', async ({ page }) => {
  await embed(page, 'meet at the north gate');
  expect(byName(await runSurvival(page), 'One bit flipped in the message body').result).toBe('Message altered');
});

test('survival: the detection score is not presented as an extraction probability', async ({ page }) => {
  await expect(page.locator('#lsb-survival-note')).toContainText('not a probability that a message can be extracted');
  for (const id of ['exhibit-3', 'lsb-survival']) {
    await expect(page.locator('#' + id)).not.toContainText(/extraction probability|probability of extraction|proof of safety/i);
  }
});

test('survival: in-memory DCT extraction is never reported as a saved-JPEG round trip', async ({ page }) => {
  await expect(page.locator('#lsb-survival-note')).toContainText('not a saved-JPEG round trip');
  await expect(page.locator('#exhibit-4')).not.toContainText(/survives JPEG|saved-JPEG round trip succeeded|JPEG round trip works/i);
});
