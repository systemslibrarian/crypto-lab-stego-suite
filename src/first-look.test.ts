import { describe, expect, it } from "vitest";
import { changedPixels, detectorVerdict } from "./first-look";
import { encodeTextPacket, decodeTextPacket } from "./lib/bits";
import { createSampleImageData } from "./lib/image";
import { embedBitsSpatial, extractBitsSpatial, lsbCapacityBits } from "./lib/stego";

const SIZE = 256;
const SEED = 37;
const SECRET = "Meet me at the library at four.";

function pair(): { cover: ImageData; stego: ImageData; bitCount: number } {
  const cover = createSampleImageData(SIZE, SIZE, SEED);
  const bits = encodeTextPacket(SECRET);
  const { stego } = embedBitsSpatial(cover, bits);
  return { cover, stego, bitCount: bits.length };
}

/**
 * The four things the front-section tells a reader, asserted as computed
 * outcomes rather than as the strings the page prints.
 */
describe("the beginner front-section's four claims", () => {
  it("embedding really changes the picture", () => {
    const { cover, stego } = pair();
    expect(changedPixels(cover, stego)).toBeGreaterThan(0);
  });

  it("the message comes back byte for byte", () => {
    const { stego, bitCount } = pair();
    expect(decodeTextPacket(extractBitsSpatial(stego, bitCount))).toBe(SECRET);
  });

  it("the same read of the untouched original does NOT return the message", () => {
    // Without this the round trip above is equally consistent with the page
    // simply remembering what it embedded.
    const { cover, bitCount } = pair();
    expect(decodeTextPacket(extractBitsSpatial(cover, bitCount))).not.toBe(SECRET);
  });

  it("the detector reports nothing found on BOTH the original and the sentence-carrier", () => {
    // Measured, not assumed. One sentence is ~0.14% of this picture's capacity,
    // and this lab's global chi-squared test does not move until ~98% of it is
    // used. An earlier draft asserted the opposite and was wrong.
    const { cover, stego } = pair();
    expect(detectorVerdict(cover).flagged).toBe(false);
    expect(detectorVerdict(stego).flagged).toBe(false);
  });

  it("filling the picture to capacity IS reported, with the same method and detector", () => {
    const cover = createSampleImageData(SIZE, SIZE, SEED);
    const capacity = lsbCapacityBits(cover);
    const filler = crypto.getRandomValues(new Uint8Array(Math.ceil(capacity / 8)));
    const bits: number[] = [];
    for (let i = 0; i < capacity; i += 1) {
      bits.push((filler[i >> 3] >> (7 - (i & 7))) & 1);
    }
    const { stego: filled } = embedBitsSpatial(cover, bits);
    expect(detectorVerdict(filled).flagged).toBe(true);
  });

  /**
   * 4.1d, the negative claim. The belief a beginner is most likely to leave
   * with is that a detector's silence means nothing is there. This asserts the
   * contradiction the section is built on: the carrier the detector calls
   * clean is DEMONSTRABLY carrying a message the reader has already read back.
   */
  it("a clean result is not proof that nothing is hidden", () => {
    const { cover, stego, bitCount } = pair();
    // Something really is in it:
    expect(changedPixels(cover, stego)).toBeGreaterThan(0);
    expect(decodeTextPacket(extractBitsSpatial(stego, bitCount))).toBe(SECRET);
    // And the detector still reports nothing:
    expect(detectorVerdict(stego).flagged).toBe(false);
  });
});
