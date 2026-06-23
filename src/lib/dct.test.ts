import { describe, expect, it } from "vitest";
import { encodeTextPacket, decodeTextPacket, bitsToBytes, bytesToU32 } from "./bits";
import { createSampleImageData } from "./image";
import { computeDctBlocks, dct2, embedBitsDct, extractBitsDct, idct2 } from "./dct";

function makeBlock(fn: (x: number, y: number) => number): number[][] {
  return Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => fn(x, y)));
}

describe("DCT", () => {
  it("dct2 followed by idct2 reconstructs the block", () => {
    const block = makeBlock((x, y) => Math.round(40 * Math.sin(x / 2) + 30 * Math.cos(y / 3)));
    const back = idct2(dct2(block));
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(Math.abs(back[y][x] - block[y][x])).toBeLessThan(1e-6);
      }
    }
  });

  it("round-trips a text packet through coefficient-parity embedding", () => {
    const cover = createSampleImageData(128, 128, 37);
    const message = "Frequency-domain embedding changes AC coefficients by ±1.";
    const bits = encodeTextPacket(message);
    const state = computeDctBlocks(cover);
    const written = embedBitsDct(state, bits);
    expect(written).toBe(bits.length);
    expect(state.embedded).toBe(true);

    const header = extractBitsDct(state, 32);
    const total = (bytesToU32(bitsToBytes(header), 0) + 4) * 8;
    expect(decodeTextPacket(extractBitsDct(state, total))).toBe(message);
  });

  it("records modified coefficients only when parity must flip", () => {
    const cover = createSampleImageData(64, 64, 11);
    const state = computeDctBlocks(cover);
    const before = state.blocks.map((b) => b.map((row) => row.slice()));
    embedBitsDct(state, encodeTextPacket("hi"));
    let actualChanges = 0;
    for (let bi = 0; bi < state.blocks.length; bi += 1) {
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          if (state.blocks[bi][y][x] !== before[bi][y][x]) {
            actualChanges += 1;
          }
        }
      }
    }
    expect(state.modified.size).toBe(actualChanges);
  });
});
