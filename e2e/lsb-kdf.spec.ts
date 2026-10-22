import { expect, test } from '@playwright/test';

// A ciphertext captured from the original mode-1 code, with synthetic data.
const LEGACY_HEX = '971377c30264f0a6b78c884ccbcf966a7ffbc52a4bb8a13ff9f684a0a3481457d7961886dc92fceba939810e2b068de6d431919407f0fa293a48016bc467460ebdfb49';

test('new encrypted images use mode 2 and still round-trip in the browser', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.lsb-kdf-note a')).toHaveAttribute('href',
    'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html');
  await page.locator('#lsb-message').fill('new KDF mode');
  await page.locator('#lsb-passphrase').fill('strong test passphrase');
  await page.locator('#lsb-encrypt').check();
  await page.locator('#lsb-embed').click();
  await expect(page.locator('#lsb-stats')).toContainText('600,000 iterations');

  const mode = await page.locator('#lsb-stego').evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const bits: number[] = [];
    for (let i = 0; i < data.length && bits.length < 40; i += 1) {
      if (i % 4 !== 3) bits.push(data[i] & 1);
    }
    return bits.slice(32, 40).reduce((v, bit) => (v << 1) | bit, 0);
  });
  expect(mode).toBe(2);

  await page.locator('#lsb-extract').click();
  await expect(page.locator('#lsb-stats')).toContainText('Recovered: new KDF mode');
  await expect(page.locator('#lsb-stats')).not.toContainText('Legacy encryption');
});

test('an actual mode-1 ciphertext in a PNG still opens and is visibly flagged', async ({ page }) => {
  await page.goto('./');
  await page.locator('#lsb-passphrase').fill('legacy-passphrase');

  const pngBase64 = await page.evaluate((hex) => {
    const payload = Uint8Array.from(hex.match(/.{2}/g)!, (pair) => parseInt(pair, 16));
    const bodyLength = 1 + 4 + payload.length;
    const packet = new Uint8Array(4 + bodyLength);
    const view = new DataView(packet.buffer);
    view.setUint32(0, bodyLength);
    packet[4] = 1; // Old encrypted mode, present in the original on-disk packet.
    view.setUint32(5, payload.length);
    packet.set(payload, 9);

    const cover = document.querySelector<HTMLCanvasElement>('#lsb-cover')!;
    const canvas = document.createElement('canvas');
    canvas.width = cover.width;
    canvas.height = cover.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(cover, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let bitIndex = 0;
    for (let i = 0; i < image.data.length && bitIndex < packet.length * 8; i += 1) {
      if (i % 4 === 3) continue;
      const bit = (packet[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
      image.data[i] = (image.data[i] & 0xfe) | bit;
      bitIndex += 1;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, LEGACY_HEX);

  await page.locator('#lsb-extract-file').setInputFiles({
    name: 'legacy-example.png', mimeType: 'image/png', buffer: Buffer.from(pngBase64, 'base64')
  });
  await expect(page.locator('#lsb-stats')).toContainText('Legacy PNG example 🔒');
  await expect(page.locator('#lsb-stats .status-warn')).toContainText('Legacy encryption used 120,000 PBKDF2 iterations');
  await expect(page.locator('#lsb-stats .status-warn')).toContainText('re-embed');
});
