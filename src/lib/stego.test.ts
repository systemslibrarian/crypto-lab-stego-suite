import { describe, expect, it } from "vitest";
import {
  bitsToBytes,
  bytesToU32,
  buildPacketBytes,
  bytesToBits,
  decodeTextPacket,
  encodeTextPacket,
  makeLsbBody,
  parseLsbBody,
  parsePacketBytes
} from "./bits";
import { createSampleImageData } from "./image";
import { embedBitsSpatial, embedByOrder, extractBitsSpatial, lsbCapacityBits } from "./stego";

describe("spatial LSB", () => {
  it("reports 3 bits of capacity per pixel", () => {
    const img = createSampleImageData(10, 10, 1);
    expect(lsbCapacityBits(img)).toBe(10 * 10 * 3);
  });

  it("round-trips an embedded text packet end-to-end", () => {
    const cover = createSampleImageData(64, 64, 37);
    const message = "Steganography hides the existence of communication. 🔒";
    const bits = encodeTextPacket(message);
    const { stego } = embedBitsSpatial(cover, bits);

    // Re-derive total length from the 32-bit header, exactly as the UI does.
    const header = extractBitsSpatial(stego, 32);
    const packetLen = bytesToU32(bitsToBytes(header), 0);
    const total = (packetLen + 4) * 8;
    const recoveredBits = extractBitsSpatial(stego, total);
    expect(decodeTextPacket(recoveredBits)).toBe(message);
  });

  it("round-trips a mode-tagged encrypted-style body", () => {
    const cover = createSampleImageData(48, 48, 3);
    const payload = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const packet = buildPacketBytes(makeLsbBody(1, payload));
    const { stego } = embedBitsSpatial(cover, bytesToBits(packet));

    const header = extractBitsSpatial(stego, 32);
    const total = (bytesToU32(bitsToBytes(header), 0) + 4) * 8;
    const body = parsePacketBytes(bitsToBytes(extractBitsSpatial(stego, total)));
    const parsed = parseLsbBody(body);
    expect(parsed.mode).toBe(1);
    expect(Array.from(parsed.payload)).toEqual(Array.from(payload));
  });

  it("only ever changes a channel by at most 1", () => {
    const cover = createSampleImageData(32, 32, 8);
    const bits = encodeTextPacket("a".repeat(120));
    const { stego } = embedBitsSpatial(cover, bits);
    for (let i = 0; i < cover.data.length; i += 1) {
      expect(Math.abs(cover.data[i] - stego.data[i])).toBeLessThanOrEqual(1);
    }
  });

  it("embedByOrder writes the blue channel of exactly the requested pixels", () => {
    const cover = createSampleImageData(8, 8, 2);
    const order = new Uint32Array([5, 1, 9, 40]);
    const bits = [1, 0, 1, 1];
    const { changed } = embedByOrder(cover, bits, order);
    expect(Array.from(changed)).toEqual([5, 1, 9, 40]);
  });
});
