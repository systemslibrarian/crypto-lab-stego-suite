import { describe, expect, it } from "vitest";
import { buildPacketBytes, LSB_MODE_AES_GCM_LEGACY, LSB_MODE_AES_GCM_PBKDF2_600K, makeLsbBody, parseLsbBody, parsePacketBytes } from "./bits";
import { decryptAesGcm, encryptAesGcm } from "./crypto";

// Captured from the original mode-1 encryptAesGcm before the work-factor change.
// The salt and IV were random, the message and passphrase are synthetic.
const LEGACY_HEX = "971377c30264f0a6b78c884ccbcf966a7ffbc52a4bb8a13ff9f684a0a3481457d7961886dc92fceba939810e2b068de6d431919407f0fa293a48016bc467460ebdfb49";
const LEGACY_PAYLOAD = Uint8Array.from(LEGACY_HEX.match(/.{2}/g)!, (pair) => parseInt(pair, 16));

describe("AES-256-GCM", () => {
  it("round-trips a message with the correct passphrase", async () => {
    const message = "Encrypt first, then hide. 中文 🔒";
    const packed = await encryptAesGcm(message, "correct horse battery staple");
    const parsed = parseLsbBody(parsePacketBytes(buildPacketBytes(makeLsbBody(LSB_MODE_AES_GCM_PBKDF2_600K, packed))));
    expect(parsed.mode).toBe(LSB_MODE_AES_GCM_PBKDF2_600K);
    expect(await decryptAesGcm(parsed.payload, "correct horse battery staple", LSB_MODE_AES_GCM_PBKDF2_600K)).toBe(message);

    // Independent WebCrypto derivation checks the *actual* work factor in the
    // emitted packet, not merely that this module can undo its own encryption.
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode("correct horse battery staple"), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: packed.slice(0, 16), iterations: 600_000, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
    );
    const independentPlain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(16, 28) }, key, packed.slice(28));
    expect(new TextDecoder().decode(independentPlain)).toBe(message);
  });

  it("fails to decrypt with the wrong passphrase", async () => {
    const packed = await encryptAesGcm("secret", "right-key");
    await expect(decryptAesGcm(packed, "wrong-key", LSB_MODE_AES_GCM_PBKDF2_600K)).rejects.toBeTruthy();
  });

  it("still decrypts a captured mode-1 payload with its original work factor", async () => {
    const parsed = parseLsbBody(parsePacketBytes(buildPacketBytes(makeLsbBody(LSB_MODE_AES_GCM_LEGACY, LEGACY_PAYLOAD))));
    expect(parsed.mode).toBe(LSB_MODE_AES_GCM_LEGACY);
    expect(await decryptAesGcm(parsed.payload, "legacy-passphrase", LSB_MODE_AES_GCM_LEGACY)).toBe("Legacy PNG example 🔒");
  });

  it("never falls back to the legacy work factor for a new or tampered packet", async () => {
    const packed = await encryptAesGcm("new format", "strong-passphrase");
    await expect(decryptAesGcm(packed, "strong-passphrase", LSB_MODE_AES_GCM_LEGACY)).rejects.toBeTruthy();
    await expect(decryptAesGcm(LEGACY_PAYLOAD, "legacy-passphrase", LSB_MODE_AES_GCM_PBKDF2_600K)).rejects.toBeTruthy();
    const tampered = packed.slice();
    tampered[tampered.length - 1] ^= 1;
    await expect(decryptAesGcm(tampered, "strong-passphrase", LSB_MODE_AES_GCM_PBKDF2_600K)).rejects.toBeTruthy();
    await expect(decryptAesGcm(packed, "strong-passphrase", 42 as typeof LSB_MODE_AES_GCM_LEGACY)).rejects.toThrow("Unsupported");
  });

  it("produces distinct ciphertext per call (random salt + IV)", async () => {
    const a = await encryptAesGcm("same message", "key");
    const b = await encryptAesGcm("same message", "key");
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("prepends a 16-byte salt and 12-byte IV", async () => {
    const packed = await encryptAesGcm("x", "key");
    // 16 salt + 12 IV + 1 byte plaintext + 16 GCM tag
    expect(packed.length).toBe(16 + 12 + 1 + 16);
  });
});
