import { describe, expect, it } from "vitest";
import { decryptAesGcm, encryptAesGcm } from "./crypto";

describe("AES-256-GCM", () => {
  it("round-trips a message with the correct passphrase", async () => {
    const message = "Encrypt first, then hide. 中文 🔒";
    const packed = await encryptAesGcm(message, "correct horse battery staple");
    expect(await decryptAesGcm(packed, "correct horse battery staple")).toBe(message);
  });

  it("fails to decrypt with the wrong passphrase", async () => {
    const packed = await encryptAesGcm("secret", "right-key");
    await expect(decryptAesGcm(packed, "wrong-key")).rejects.toBeTruthy();
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
