import { describe, expect, it } from "vitest";
import {
  bitsToBytes,
  bytesToBits,
  bytesToU32,
  buildPacketBytes,
  decodeTextPacket,
  encodeTextPacket,
  makeLsbBody,
  parseLsbBody,
  parsePacketBytes,
  u32ToBytes
} from "./bits";

describe("bit/byte codec", () => {
  it("round-trips bytes through bits", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 200, 255, 42, 7]);
    expect(Array.from(bitsToBytes(bytesToBits(bytes)))).toEqual(Array.from(bytes));
  });

  it("encodes a byte as 8 MSB-first bits", () => {
    expect(bytesToBits(new Uint8Array([0b10110001]))).toEqual([1, 0, 1, 1, 0, 0, 0, 1]);
  });

  it("round-trips u32 big-endian", () => {
    for (const v of [0, 1, 255, 256, 65535, 16777216, 4294967295]) {
      expect(bytesToU32(u32ToBytes(v), 0)).toBe(v);
    }
  });

  it("round-trips length-prefixed packets", () => {
    const body = new Uint8Array([9, 8, 7, 6, 5]);
    const packet = buildPacketBytes(body);
    expect(packet.length).toBe(4 + body.length);
    expect(Array.from(parsePacketBytes(packet))).toEqual(Array.from(body));
  });

  it("round-trips LSB body (mode + payload)", () => {
    const payload = new Uint8Array([10, 20, 30]);
    const parsed = parseLsbBody(makeLsbBody(1, payload));
    expect(parsed.mode).toBe(1);
    expect(Array.from(parsed.payload)).toEqual(Array.from(payload));
  });

  it("round-trips text packets including unicode", () => {
    for (const text of ["", "hello", "Stego ✓ 中文 — 🔒"]) {
      expect(decodeTextPacket(encodeTextPacket(text))).toBe(text);
    }
  });
});
