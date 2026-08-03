import { expect, test, type Page } from '@playwright/test';

/**
 * Functional claims gate for Stego Suite.
 *
 * The a11y suite proves the page is reachable; this suite proves it is TRUE.
 * Every headline verdict, counter and failure path is driven in a real browser
 * and checked against a value re-derived here: the packet layout is rebuilt
 * from the message text, the capacity and fidelity numbers are recomputed, the
 * chi-squared verdicts are checked against the probabilities the page itself
 * printed, and every carrier that should fail extraction (altered header,
 * altered payload, never-embedded cover, JPEG re-encode) is actually built and
 * fed back through the app's own "Extract from PNG" control.
 */

const COVER_W = 256;
const COVER_H = 256;
const CAPACITY_BITS = COVER_W * COVER_H * 3;
const AES_OVERHEAD = 16 + 12 + 16; // salt + IV + GCM tag
const HEADER_BYTES = 4 + 1 + 4; // packet length + mode + payload length

function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Bits an LSB packet occupies for a plaintext payload of this many bytes. */
function packetBits(payloadBytes: number): number {
  return (HEADER_BYTES + payloadBytes) * 8;
}

/** The exact packet bit stream the walkthrough claims to be hiding. */
function walkPacketBits(message: string): number[] {
  const payload = utf8(message);
  const bodyLen = 1 + 4 + payload.length;
  const bytes = [
    ...u32(bodyLen),
    0, // mode: plaintext
    ...u32(payload.length),
    ...payload,
  ];
  const bits: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i -= 1) bits.push((b >> i) & 1);
  return bits;
}

function u32(v: number): number[] {
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
}

function nums(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((s) => Number(s.replace(/,/g, '')));
}

function numAfter(text: string, label: string | RegExp): number {
  const src = typeof label === 'string' ? label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : label.source;
  const hit = new RegExp(`${src}[^0-9]*(\\d[\\d,]*(?:\\.\\d+)?)`).exec(text);
  expect(hit, `expected a number after ${String(label)} in: ${text}`).not.toBeNull();
  return Number(hit![1].replace(/,/g, ''));
}

async function setText(page: Page, id: string, value: string): Promise<void> {
  await page.locator(`#${id}`).evaluate((el, v) => {
    const input = el as HTMLTextAreaElement | HTMLInputElement;
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

/** Blank a status region so what we read back was written by the action under test. */
async function blank(page: Page, ...ids: string[]): Promise<void> {
  await page.evaluate((list) => {
    for (const id of list) {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    }
  }, ids);
}

async function embed(page: Page): Promise<string> {
  await blank(page, 'lsb-stats');
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.locator('#lsb-embed')).toBeEnabled();
  return page.locator('#lsb-stats').innerText();
}

async function extract(page: Page): Promise<string> {
  await blank(page, 'lsb-stats');
  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats')).not.toBeEmpty({ timeout: 30_000 });
  await expect(page.locator('#lsb-extract')).toBeEnabled();
  return page.locator('#lsb-stats').innerText();
}

/**
 * Grab the current stego canvas as a PNG, optionally mutating pixel data first,
 * and feed it back through the app's own "Extract from PNG" control.
 */
async function uploadCarrier(
  page: Page,
  opts: { canvasId?: string; mutateIndex?: number; jpeg?: boolean } = {},
): Promise<string> {
  const dataUrl = await page.evaluate(
    ({ canvasId, mutateIndex, jpeg }) => {
      const src = document.getElementById(canvasId ?? 'lsb-stego') as HTMLCanvasElement;
      const ctx = src.getContext('2d')!;
      const img = ctx.getImageData(0, 0, src.width, src.height);
      if (typeof mutateIndex === 'number') img.data[mutateIndex] ^= 1; // flip one LSB
      const tmp = document.createElement('canvas');
      tmp.width = src.width;
      tmp.height = src.height;
      tmp.getContext('2d')!.putImageData(img, 0, 0);
      return jpeg ? tmp.toDataURL('image/jpeg', 0.92) : tmp.toDataURL('image/png');
    },
    opts,
  );
  const [meta, b64] = dataUrl.split(',');
  await blank(page, 'lsb-stats');
  await page.locator('#lsb-extract-file').setInputFiles({
    name: opts.jpeg ? 'carrier.jpg' : 'carrier.png',
    mimeType: meta.includes('jpeg') ? 'image/jpeg' : 'image/png',
    buffer: Buffer.from(b64, 'base64'),
  });
  await expect(page.locator('#lsb-stats')).not.toBeEmpty({ timeout: 30_000 });
  return page.locator('#lsb-stats').innerText();
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#lsb-embed')).toBeVisible();
});

// ════════════ Cover source and capacity meter ════════════

test('cover: the shared sample carrier is the size every exhibit budgets against', async ({ page }) => {
  const label = await page.locator('#cover-source-name').innerText();
  expect(label).toContain('Sample landscape');
  expect(nums(label).slice(0, 2)).toEqual([COVER_W, COVER_H]);

  const capacity = await page.locator('#lsb-capacity-text').innerText();
  expect(numAfter(capacity, 'bits of'), '3 bits per pixel, one per colour channel').toBe(CAPACITY_BITS);
});

test('capacity meter: the payload budget is the packet size, and encryption adds exactly its overhead', async ({ page }) => {
  for (const message of ['a', 'Steganography hides the existence of communication.', 'x'.repeat(200)]) {
    await setText(page, 'lsb-message', message);
    const text = await page.locator('#lsb-capacity-text').innerText();
    const bits = numAfter(text, 'Payload');
    const expected = packetBits(utf8(message).length);
    expect(bits, `packet bits for a ${utf8(message).length}-byte message`).toBe(expected);
    expect(numAfter(text, 'bits of')).toBe(CAPACITY_BITS);
    // The percentage is the fraction of the carrier this payload consumes.
    expect(numAfter(text, /\(/)).toBe(Number(((expected / CAPACITY_BITS) * 100).toFixed(2)));

    // Ticking AES-256-GCM must add exactly salt + IV + tag, nothing else.
    await page.locator('#lsb-encrypt').check();
    const enc = await page.locator('#lsb-capacity-text').innerText();
    expect(numAfter(enc, 'Payload') - bits).toBe(AES_OVERHEAD * 8);
    expect(enc).toContain('includes AES salt/IV/tag overhead');
    await page.locator('#lsb-encrypt').uncheck();
  }

  // The meter bar tracks the same fraction it prints.
  const width = await page.locator('#lsb-capacity-fill').evaluate((el) => (el as HTMLElement).style.width);
  expect(Number(width.replace('%', ''))).toBeCloseTo((packetBits(200) / CAPACITY_BITS) * 100, 2);
});

// ════════════ Exhibit 2 — the bit-by-bit walkthrough ════════════

test('walkthrough: every step hides the real packet bit, in the right channel, at the right pixel', async ({ page }) => {
  const message = 'walkthrough payload';
  await setText(page, 'lsb-message', message);
  const bits = walkPacketBits(message);

  await expect(page.locator('#lsb-walk-prev')).toBeDisabled();
  for (let step = 0; step < 10; step += 1) {
    if (step > 0) await page.locator('#lsb-walk-next').click();
    const caption = await page.locator('#lsb-walk-caption').innerText();
    const byteText = await page.locator('#lsb-walk-byte').innerText();

    expect(numAfter(caption, 'Bit'), 'the step counter').toBe(step + 1);
    expect(numAfter(caption, 'of'), 'total packet bits').toBe(bits.length);
    expect(numAfter(caption, 'message bit'), `packet bit ${step}`).toBe(bits[step]);

    // Bit k goes to channel k % 3 of pixel floor(k / 3).
    const channel = ['red', 'green', 'blue'][step % 3];
    expect(caption).toContain(`${channel} channel of pixel`);
    expect(byteText.split('\n')[0].toLowerCase()).toBe(channel);
    const pixel = Math.floor(step / 3);
    const coords = /pixel \((\d+), (\d+)\)/.exec(caption)!;
    expect([Number(coords[1]), Number(coords[2])]).toEqual([pixel % COVER_W, Math.floor(pixel / COVER_W)]);

    // The rendered byte's own bits must equal the value it prints, and its LSB
    // must be the message bit.
    const lines = byteText.split('\n').map((l) => l.trim()).filter(Boolean);
    const cellBits = lines.slice(1, 9).map(Number);
    expect(cellBits).toHaveLength(8);
    const shown = numAfter(byteText, '=');
    expect(cellBits.reduce((acc, b) => acc * 2 + b, 0), 'the eight cells spell the printed value').toBe(shown);
    expect(cellBits[7], 'the LSB carries the payload bit').toBe(bits[step]);

    // The prose agrees with the arithmetic: value after = (before & 0xfe) | bit.
    const flip = /value goes <?\/?strong>?(\d+) → (\d+)/.exec(caption) ?? /value goes (\d+) → (\d+)/.exec(caption);
    if (flip) {
      const [before, after] = [Number(flip[1]), Number(flip[2])];
      expect(after).toBe((before & 0xfe) | bits[step]);
      expect(Math.abs(after - before), 'LSB substitution moves a channel by at most 1').toBe(1);
      expect(after).toBe(shown);
    } else {
      const kept = numAfter(caption, 'value stays');
      expect(kept & 1, 'no change means the LSB already matched').toBe(bits[step]);
      expect(kept).toBe(shown);
    }
  }
  await expect(page.locator('#lsb-walk-next')).toBeDisabled();

  // Restart returns to the first bit.
  await page.locator('#lsb-walk-reset').click();
  expect(numAfter(await page.locator('#lsb-walk-caption').innerText(), 'Bit')).toBe(1);
  await expect(page.locator('#lsb-walk-prev')).toBeDisabled();
});

test('walkthrough: the packet-byte note counts bytes, not bits', async ({ page }) => {
  // Regression: the note used to print the BIT index as a "byte position" and
  // assert all ten were in the 4-byte length header, which byte 5 onward is not.
  await setText(page, 'lsb-message', 'byte position regression');
  for (let step = 0; step < 10; step += 1) {
    if (step > 0) await page.locator('#lsb-walk-next').click();
    const note = await page.locator('#lsb-walk-caption .walk-note').innerText();
    expect(numAfter(note, 'bit')).toBe((step % 8) + 1);
    const byte = numAfter(note, 'packet byte');
    expect(byte, 'eight bits to a byte').toBe(Math.floor(step / 8) + 1);
    expect(byte).toBeLessThanOrEqual(4);
    expect(note, 'bytes 1-4 really are the length header').toContain('4-byte length header');
  }
});

// ════════════ Exhibit 2 — embed, extract, and its failure paths ════════════

test('LSB embed: the reported payload, capacity and fidelity are all recomputable', async ({ page }) => {
  const message = 'Steganography hides the existence of communication.';
  await setText(page, 'lsb-message', message);
  const stats = await embed(page);
  const bytes = utf8(message).length;

  expect(numAfter(stats, 'Payload:')).toBe(bytes);
  expect(numAfter(stats, 'bytes plaintext,'), 'plaintext mode stores exactly the plaintext').toBe(bytes);
  expect(numAfter(stats, 'Capacity:'), 'capacity in bytes is the bit capacity over 8').toBe(CAPACITY_BITS / 8);
  expect(stats).toContain('Plaintext steganography');

  // The headline fidelity claim: a channel moves by at most 1.
  expect(numAfter(stats, 'max channel change')).toBe(1);
  const psnr = numAfter(stats, 'PSNR');
  expect(psnr, 'a one-LSB edit is visually imperceptible').toBeGreaterThan(60);

  // Roughly half the embedded bits differ from the LSB already there.
  const changed = numAfter(stats, 'dB, max channel change 1,');
  const embedded = packetBits(bytes);
  expect(changed).toBeGreaterThan(embedded * 0.2);
  expect(changed, 'no channel outside the payload run may be touched').toBeLessThanOrEqual(embedded);

  // The first-change sample obeys the substitution rule it describes.
  const first = /before (\d+) \(LSB (\d)\), after (\d+) \(LSB (\d)\), payload bit (\d)/.exec(stats)!;
  const [before, lsbBefore, after, lsbAfter, bit] = first.slice(1).map(Number);
  expect(after).toBe((before & 0xfe) | bit);
  expect(lsbBefore).toBe(before & 1);
  expect(lsbAfter).toBe(after & 1);
  expect(after).not.toBe(before); // it is the FIRST CHANGE, after all
});

test('LSB round trip: the extracted message is the message that was embedded', async ({ page }) => {
  for (const message of ['Steganography hides the existence of communication.', 'short', 'unicode: naïve café ✓']) {
    await setText(page, 'lsb-message', message);
    await embed(page);
    const out = await extract(page);
    expect(out).toContain(`Recovered: ${message}`);
    expect(out).toContain('Mode: plain');
  }
});

test('LSB: extracting before embedding, and after a reset, refuses instead of inventing a message', async ({ page }) => {
  expect(await extract(page)).toContain('No message embedded yet');

  await embed(page);
  expect(await extract(page)).toContain('Recovered:');

  await blank(page, 'lsb-stats');
  await page.locator('#lsb-reset').click();
  await expect(page.locator('#lsb-stats')).toContainText('reset to the current cover');
  expect(await extract(page)).toContain('No message embedded yet');
});

test('LSB: an empty message and a passphrase-less encryption are both refused', async ({ page }) => {
  await setText(page, 'lsb-message', '');
  expect(await embed(page)).toContain('Provide a message first');

  await setText(page, 'lsb-message', 'needs a key');
  await page.locator('#lsb-encrypt').check();
  await page.locator('#lsb-passphrase').fill('');
  expect(await embed(page)).toContain('passphrase is required');
});

test('AES: encrypt-then-embed stores exactly the overhead, and only the right passphrase recovers it', async ({ page }) => {
  const message = 'encrypt first, then hide';
  await setText(page, 'lsb-message', message);
  await page.locator('#lsb-encrypt').check();
  await page.locator('#lsb-passphrase').fill('correct horse battery staple');

  const stats = await embed(page);
  const plain = utf8(message).length;
  expect(numAfter(stats, 'Payload:')).toBe(plain);
  expect(numAfter(stats, 'bytes plaintext,'), 'salt + IV + GCM tag on top of the plaintext').toBe(plain + AES_OVERHEAD);
  expect(stats).toContain('AES-256-GCM then steganography');
  expect(numAfter(stats, 'max channel change')).toBe(1);

  expect(await extract(page)).toContain(`Recovered: ${message}`);
  expect(await page.locator('#lsb-stats').innerText()).toContain('encrypted (passphrase used)');

  // Wrong key: the payload is found but must not decrypt.
  await page.locator('#lsb-passphrase').fill('wrong passphrase');
  const wrong = await extract(page);
  expect(wrong).toContain('Decryption failed');
  expect(wrong).not.toContain(message);

  // No key at all: told what is missing, still no plaintext.
  await page.locator('#lsb-passphrase').fill('');
  const none = await extract(page);
  expect(none).toContain('enter the passphrase to decrypt');
  expect(none).not.toContain(message);
});

// ════════════ Exhibit 2 — carrier round trip and altered carriers ════════════

test('carrier: the exported stego PNG re-uploads and extracts the same message', async ({ page }) => {
  const message = 'round trip through a real PNG';
  await setText(page, 'lsb-message', message);
  await embed(page);

  // The documented flow: download the stego PNG, then feed it back in.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#lsb-download').click(),
  ]);
  expect(download.suggestedFilename()).toBe('stego-lsb.png');

  const out = await uploadCarrier(page);
  expect(out).toContain(`Recovered: ${message}`);
  expect(out).toContain(`${COVER_W}×${COVER_H}`);
  expect(out).toContain('mode: plain');
});

test('carrier: flipping one bit of the length header makes extraction fail outright', async ({ page }) => {
  await setText(page, 'lsb-message', 'header integrity');
  await embed(page);
  // Channel 0 of pixel 0 carries packet bit 0 — the top bit of the length field.
  const out = await uploadCarrier(page, { mutateIndex: 0 });
  expect(out).toContain('No valid hidden packet found in this image');
  expect(out).not.toContain('Recovered:');
});

test('carrier: altering the payload region corrupts the recovered message', async ({ page }) => {
  const message = 'payload integrity matters here';
  await setText(page, 'lsb-message', message);
  await embed(page);

  // Channel index 4*40+1 is the green channel of pixel 40, i.e. packet bit 121 —
  // well past the 9-byte header, inside the message body.
  const out = await uploadCarrier(page, { mutateIndex: 4 * 40 + 1 });
  expect(out, 'an altered carrier must not yield the original message').not.toContain(`Recovered: ${message}`);

  // The packet still parses (only a body byte moved), so the demo shows the
  // damage rather than an error: exactly one character differs.
  const recovered = /Recovered: (.*?) Copy/.exec(out)![1];
  expect(recovered).toHaveLength(message.length);
  const diffs = [...recovered].filter((c, i) => c !== message[i]);
  expect(diffs, 'one flipped carrier bit damages exactly one character').toHaveLength(1);
});

test('carrier: a cover image that never carried a payload is reported as empty', async ({ page }) => {
  const out = await uploadCarrier(page, { canvasId: 'lsb-cover' });
  expect(out).toContain('No valid hidden packet found in this image');
});

test('carrier: JPEG re-encoding destroys the hidden bits, exactly as the README warns', async ({ page }) => {
  const message = 'jpeg will eat these bits';
  await setText(page, 'lsb-message', message);
  await embed(page);

  const out = await uploadCarrier(page, { jpeg: true });
  expect(out, 'lossy re-encoding must not round-trip').not.toContain(`Recovered: ${message}`);
  expect(out).toContain('Re-encoding to JPEG destroys LSBs');
});

// ════════════ Exhibit 3 — chi-squared steganalysis ════════════

/** "χ²=N, probability of embedding=P%" plus the verdict text. */
function readChi(text: string): { chi2: number; pct: number; detected: boolean } {
  const chi2 = numAfter(text, 'χ²=');
  const pct = numAfter(text, 'probability of embedding=');
  return { chi2, pct, detected: text.includes('✗ LSB embedding detected') };
}

test('chi-squared: the verdict follows the probability the test computed', async ({ page }) => {
  await page.locator('#chi-test-cover').click();
  await expect(page.locator('#chi-results')).toContainText('Cover test');
  const cover = readChi(await page.locator('#chi-results').innerText());
  expect(cover.chi2).toBeGreaterThan(0);
  expect(cover.detected, 'the verdict is the 50% rule applied to the printed probability').toBe(cover.pct > 50);
  expect(cover.detected, 'a never-embedded cover must not be flagged').toBe(false);

  // The plotted distribution is drawn for the dof actually used.
  const caption = await page.locator('#chi-plot-caption').innerText();
  const dof = numAfter(caption, 'dof =');
  expect(dof).toBeGreaterThan(0);
  expect(dof, 'at most 128 value-pairs, minus one constraint').toBeLessThanOrEqual(127);

  await embed(page);
  await page.locator('#chi-test-stego').click();
  await expect(page.locator('#chi-results')).toContainText('Stego test');
  const stego = readChi(await page.locator('#chi-results').innerText());
  expect(stego.detected).toBe(stego.pct > 50);
});

test('chi-squared: testing the stego image before anything is hidden says so', async ({ page }) => {
  await page.locator('#chi-test-stego').click();
  await expect(page.locator('#chi-results')).toContainText('No LSB embedding done yet');
  await expect(page.locator('#chi-dep-hint')).toBeVisible();

  // …and the sequencing hint retires once the dependency is satisfied.
  await embed(page);
  await expect(page.locator('#chi-dep-hint')).toBeHidden();
});

test('chi-squared: the detectability curve only fires near full capacity', async ({ page }) => {
  await page.locator('#chi-run-curve').click();
  await expect(page.locator('#chi-curve table')).toBeVisible({ timeout: 60_000 });

  const rows = await page.locator('#chi-curve tbody tr').evaluateAll((trs) =>
    trs.map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent ?? '')),
  );
  expect(rows).toHaveLength(3);

  const rates = [0.1, 0.5, 1.0];
  rows.forEach((cells, i) => {
    expect(Number(cells[0].replace('%', '')) / 100).toBeCloseTo(rates[i], 5);
    expect(Number(cells[1].replace(/,/g, '')), 'bits = floor(capacity x rate)').toBe(Math.floor(CAPACITY_BITS * rates[i]));
    const pct = Number(cells[3].replace('%', ''));
    const detected = cells[4].includes('detected');
    expect(detected, `row ${i}: verdict must follow the printed probability`).toBe(pct > 50);
  });

  // The README's claim: partial payloads slip past, full embedding does not.
  const pcts = rows.map((c) => Number(c[3].replace('%', '')));
  expect(pcts[0], '10% payload evades the global test').toBeLessThanOrEqual(50);
  expect(pcts[2], 'a fully embedded carrier is caught').toBeGreaterThan(50);
  expect(pcts[2]).toBeGreaterThan(pcts[0]);
  expect(await page.locator('#chi-curve small').innerText()).toContain('nears full capacity');
});

test('chi-squared toy: the residual falls off as (1 - fraction)^2 and vanishes at full embedding', async ({ page }) => {
  const readToy = async (): Promise<{ pct: number; chi2: number; flagged: boolean }> => {
    const caption = await page.locator('#chi-toy-caption').innerText();
    return {
      pct: numAfter(caption, 'Embedded fraction'),
      chi2: numAfter(caption, 'these 8 pairs ='),
      flagged: caption.includes('nearly equalized'),
    };
  };

  await page.locator('#chi-toy-slider').evaluate((el) => {
    (el as HTMLInputElement).value = '0';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const base = await readToy();
  expect(base.pct).toBe(0);
  expect(base.chi2, 'a natural cover has lopsided pairs').toBeGreaterThan(10);
  expect(base.flagged).toBe(false);

  let previous = base.chi2;
  for (const f of [25, 50, 75, 100]) {
    await page.locator('#chi-toy-slider').evaluate((el, v) => {
      (el as HTMLInputElement).value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, f);
    await expect(page.locator('#chi-toy-readout')).toHaveText(`${f}%`);
    const now = await readToy();
    expect(now.pct).toBe(f);
    // Randomizing a fraction f moves each pair (1 - f/2) of the way, so the
    // residual scales by (1 - f)^2 against the unembedded baseline.
    expect(now.chi2).toBeCloseTo(base.chi2 * (1 - f / 100) ** 2, 1);
    expect(now.chi2).toBeLessThan(previous);
    previous = now.chi2;
    expect(now.flagged, 'the "LSB fingerprint" call is the residual crossing 2').toBe(now.chi2 < 2);
  }
  expect(previous, 'full randomization equalizes every pair exactly').toBe(0);
});

// ════════════ Exhibit 4 — DCT-domain embedding ════════════

test('DCT: the bit count is the packet size, and the message survives the coefficient round trip', async ({ page }) => {
  const message = 'Frequency-domain embedding changes AC coefficients by ±1.';
  await setText(page, 'dct-message', message);

  await blank(page, 'dct-stats');
  await page.locator('#dct-transform').click();
  await expect(page.locator('#dct-stats')).toContainText('Computed 8×8 block DCT');

  await blank(page, 'dct-stats');
  await page.locator('#dct-embed').click();
  await expect(page.locator('#dct-stats')).toContainText('Embedded', { timeout: 30_000 });
  const stats = await page.locator('#dct-stats').innerText();
  // The DCT exhibit writes a bare length-prefixed packet: 4 bytes + payload.
  expect(numAfter(stats, 'Embedded')).toBe((4 + utf8(message).length) * 8);
  expect(stats).toContain('Complete payload embedded');
  expect(stats).toContain('±1 coefficient edits');

  await page.locator('#dct-inverse').click();
  await expect(page.locator('#dct-stats')).toContainText('Inverse DCT rendered');

  await blank(page, 'dct-stats');
  await page.locator('#dct-extract').click();
  await expect(page.locator('#dct-stats')).toContainText('Recovered', { timeout: 30_000 });
  expect(await page.locator('#dct-stats').innerText()).toContain(`Recovered: ${message}`);
});

test('DCT: extracting before embedding refuses instead of decoding noise', async ({ page }) => {
  await page.locator('#dct-transform').click();
  await blank(page, 'dct-stats');
  await page.locator('#dct-extract').click();
  await expect(page.locator('#dct-stats')).toContainText('No message embedded in DCT yet');
  expect(await page.locator('#dct-stats').innerText()).not.toContain('Recovered');
});

// ════════════ Exhibit 5 — adaptive vs sequential ════════════

test('adaptive: the comparison numbers back the stealth claim, and the chi verdict follows the data', async ({ page }) => {
  const message = 'Embed in texture, avoid smooth sky and flat regions.';
  await setText(page, 'adapt-message', message);
  const bits = (4 + utf8(message).length) * 8;

  await blank(page, 'adapt-stats');
  await page.locator('#adapt-map').click();
  await expect(page.locator('#adapt-stats')).toContainText('Sobel gradient magnitude');

  await blank(page, 'adapt-stats');
  await page.locator('#adapt-embed').click();
  await expect(page.locator('#adapt-stats')).toContainText('Adaptive embedding wrote', { timeout: 30_000 });
  expect(numAfter(await page.locator('#adapt-stats').innerText(), 'wrote')).toBe(bits);

  await page.locator('#adapt-seq').click();
  await expect(page.locator('#adapt-stats')).toContainText('Sequential baseline plotted');

  await blank(page, 'adapt-stats');
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('different placement', { timeout: 30_000 });
  const stats = await page.locator('#adapt-stats').innerText();

  // Same payload, different placement — the counter must be the same bit count.
  expect(numAfter(stats, 'Same')).toBe(bits);

  const texture = /adaptive ([\d.]+) vs sequential ([\d.]+)/.exec(stats)!;
  const [adaptTexture, seqTexture] = texture.slice(1).map(Number);
  expect(adaptTexture, 'adaptive picks the busiest pixels first').toBeGreaterThan(seqTexture);

  const smooth = /adaptive ([\d.]+)% vs sequential ([\d.]+)%/.exec(stats)!;
  const [adaptSmooth, seqSmooth] = smooth.slice(1).map(Number);
  expect(adaptSmooth, 'adaptive keeps its bits out of smooth regions').toBeLessThan(seqSmooth);
  expect(adaptSmooth).toBeLessThanOrEqual(1);
  expect(seqSmooth, 'sequential starts on the smooth sky').toBeGreaterThan(50);

  // The chi-squared sentence is read off the two probabilities, not asserted.
  const seqP = numAfter(stats, 'sequential');
  const adaptP = numAfter(stats.split('P(embedding)')[1], 'adaptive');
  const seqSeen = seqP > 50;
  const adaptSeen = adaptP > 50;
  const expected = !seqSeen && !adaptSeen
    ? 'flags neither at this payload'
    : seqSeen && adaptSeen
      ? 'flags both at this payload'
      : seqSeen
        ? 'flags the sequential carrier but not the adaptive one'
        : 'flags the adaptive carrier but not the sequential one';
  expect(stats, `verdict must match seqP=${seqP}%, adaptP=${adaptP}%`).toContain(expected);
});

test('adaptive: comparing before both placements exist refuses instead of comparing nothing', async ({ page }) => {
  await blank(page, 'adapt-stats');
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('Run both adaptive and sequential embedding first');
  await expect(page.locator('#adapt-dep-hint')).toBeVisible();

  await page.locator('#adapt-embed').click();
  await expect(page.locator('#adapt-stats')).toContainText('Adaptive embedding wrote', { timeout: 30_000 });
  await blank(page, 'adapt-stats');
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('Run both adaptive and sequential embedding first');

  await page.locator('#adapt-seq').click();
  await expect(page.locator('#adapt-stats')).toContainText('Sequential baseline plotted');
  await expect(page.locator('#adapt-dep-hint')).toBeHidden();
  await blank(page, 'adapt-stats');
  await page.locator('#adapt-compare').click();
  await expect(page.locator('#adapt-stats')).toContainText('different placement', { timeout: 30_000 });
});
