import { describe, expect, it } from "vitest";
import { cloneImageData, computeHistogram, createSampleImageData, distortion } from "./image";

describe("image helpers", () => {
  it("creates an opaque sample image of the requested size", () => {
    const img = createSampleImageData(32, 24, 37);
    expect(img.width).toBe(32);
    expect(img.height).toBe(24);
    expect(img.data.length).toBe(32 * 24 * 4);
    for (let i = 3; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(255);
    }
  });

  it("is deterministic for a given seed and differs across seeds", () => {
    const a = createSampleImageData(16, 16, 1);
    const b = createSampleImageData(16, 16, 1);
    const c = createSampleImageData(16, 16, 2);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    expect(Array.from(a.data)).not.toEqual(Array.from(c.data));
  });

  it("histogram counts every RGB channel sample", () => {
    const img = createSampleImageData(20, 20, 5);
    const total = computeHistogram(img).reduce((s, n) => s + n, 0);
    expect(total).toBe(20 * 20 * 3);
  });

  it("reports infinite PSNR and zero delta for identical images", () => {
    const img = createSampleImageData(16, 16, 9);
    const m = distortion(img, cloneImageData(img));
    expect(m.psnr).toBe(Infinity);
    expect(m.maxDelta).toBe(0);
    expect(m.changedChannels).toBe(0);
  });

  it("reports max delta 1 and high finite PSNR for single-LSB changes", () => {
    const cover = createSampleImageData(16, 16, 9);
    const stego = cloneImageData(cover);
    // Flip the LSB of several red channels.
    for (let i = 0; i < stego.data.length; i += 4) {
      stego.data[i] = stego.data[i] ^ 1;
    }
    const m = distortion(cover, stego);
    expect(m.maxDelta).toBe(1);
    expect(m.changedChannels).toBe(16 * 16);
    expect(m.psnr).toBeGreaterThan(40);
    expect(Number.isFinite(m.psnr)).toBe(true);
  });
});
