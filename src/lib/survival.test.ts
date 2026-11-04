import { describe, expect, it } from "vitest";
import { LSB_MODE_AES_GCM_PBKDF2_600K, LSB_MODE_PLAIN, buildPacketBytes, bytesToBits, makeLsbBody } from "./bits";
import { encryptAesGcm } from "./crypto";
import { cloneImageData, createSampleImageData } from "./image";
import { embedBitsSpatial } from "./stego";
import { assessCarrier, compareTransforms, cropLeft, payloadBitErrors, perturb, scaleBilinear } from "./survival";

/*
 * Carrier survival, written before survival.ts from the sources it implements:
 * Wayner, Disappearing Cryptography (3rd ed., 2009): lossy compression does not reconstruct a
 * carrier exactly and usually destroys subtle embedded changes; detecting that a message may be
 * present differs from recovering it, and an attacker can destroy a fragile message without
 * reading it. The book is cited by title only. The ebook review adds: unchanged PNG reload must
 * succeed; transformed carriers report measured outcomes, not guaranteed survival; with
 * encryption, a carrier/header failure is distinct from an authentication failure where the
 * packet survives far enough to attempt decryption.
 */

const MESSAGE = "meet at the north gate";

function plainStego() {
  const cover = createSampleImageData(64, 64, 11);
  // The same packet the LSB exhibit embeds: length, mode byte, payload length, payload.
  const bits = bytesToBits(buildPacketBytes(makeLsbBody(LSB_MODE_PLAIN, new TextEncoder().encode(MESSAGE))));
  return { stego: embedBitsSpatial(cover, bits).stego, bits };
}

async function encryptedStego(passphrase: string) {
  const cover = createSampleImageData(64, 64, 12);
  const payload = await encryptAesGcm(MESSAGE, passphrase);
  const bits = bytesToBits(buildPacketBytes(makeLsbBody(LSB_MODE_AES_GCM_PBKDF2_600K, payload)));
  return { stego: embedBitsSpatial(cover, bits).stego, bits };
}

/** Flip the LSB of the k-th embedded bit slot (R, G, B order, alpha skipped). */
function flipSlot(image: ImageData, k: number): ImageData {
  const out = cloneImageData(image);
  const pixel = Math.floor(k / 3), channel = k % 3;
  out.data[pixel * 4 + channel] ^= 1;
  return out;
}

describe("carrier survival", () => {
  it("unchanged reload recovers the message with no bit errors", async () => {
    const { stego, bits } = plainStego();
    const [row] = await compareTransforms(stego, bits, MESSAGE, undefined, [{ name: "Exact reload", apply: img => cloneImageData(img) }]);
    expect(row.outcome).toBe("recovered");
    expect(row.bitErrors).toBe(0);
    expect(row.psnr).toBe(Infinity);
  });

  it("bit error rate is measured against the embedded bits", () => {
    const { stego, bits } = plainStego();
    const damaged = flipSlot(flipSlot(flipSlot(stego, 40), 41), 90);
    const r = payloadBitErrors(bits, damaged);
    expect(r.errors).toBe(3);
    expect(r.compared).toBe(bits.length);
  });

  it("a plaintext bit flip alters the message", async () => {
    const { stego } = plainStego();
    // Bits 0-31 are the packet length and 32-71 the mode and payload length; 80 is in the text.
    const r = await assessCarrier(flipSlot(stego, 80), MESSAGE);
    expect(r.outcome).toBe("message altered");
  });

  it("a header bit flip is a carrier failure, not an authentication failure", async () => {
    const pass = "correct horse";
    const { stego } = await encryptedStego(pass);
    const r = await assessCarrier(flipSlot(stego, 2), MESSAGE, pass);
    expect(r.outcome).toBe("carrier failure");
  });

  it("a ciphertext bit flip is an authentication failure: the packet survives far enough to try decryption", async () => {
    const pass = "correct horse";
    const { stego, bits } = await encryptedStego(pass);
    const r = await assessCarrier(flipSlot(stego, bits.length - 20), MESSAGE, pass);
    expect(r.outcome).toBe("authentication failure");
  });

  it("an encrypted carrier with the right passphrase recovers the message", async () => {
    const pass = "correct horse";
    const { stego } = await encryptedStego(pass);
    expect((await assessCarrier(stego, MESSAGE, pass)).outcome).toBe("recovered");
  });

  it("cropping is measured, not assumed: it reports bit errors and does not recover", async () => {
    const { stego, bits } = plainStego();
    const [row] = await compareTransforms(stego, bits, MESSAGE, undefined, [{ name: "Crop", apply: img => cropLeft(img, 4) }]);
    expect(row.outcome).not.toBe("recovered");
    expect(row.bitErrors).toBeGreaterThan(0);
    expect(row.psnr).toBeNull();
    expect(row.sizeNote).toBe("64×64 → 60×64");
  });

  it("small perturbations report a measured bit error rate", async () => {
    const { stego, bits } = plainStego();
    const [row] = await compareTransforms(stego, bits, MESSAGE, undefined, [{ name: "Noise", apply: img => perturb(img, 0.05, 3) }]);
    expect(row.bitErrors).toBeGreaterThan(0);
    expect(row.bitErrors).toBeLessThan(row.comparedBits);
    expect(Number.isFinite(row.psnr)).toBe(true);
  });

  it("rescaling changes the pixel grid and is reported as a size change", async () => {
    const { stego, bits } = plainStego();
    const [row] = await compareTransforms(stego, bits, MESSAGE, undefined, [{ name: "Scale", apply: img => scaleBilinear(img, 0.9) }]);
    expect(row.sizeNote).toBe("64×64 → 58×58");
    expect(row.outcome).not.toBe("recovered");
  });

  it("outcome details report measurements, never promises", async () => {
    const { stego, bits } = plainStego();
    const rows = await compareTransforms(stego, bits, MESSAGE, undefined, [
      { name: "Exact reload", apply: img => cloneImageData(img) },
      { name: "Noise", apply: img => perturb(img, 0.05, 3) }
    ]);
    for (const row of rows) expect(row.detail).not.toMatch(/guarantee|always survives|safe from|undetectable/i);
  });
});
