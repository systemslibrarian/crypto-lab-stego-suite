import { describe, expect, it } from "vitest";
import { createSampleImageData } from "./image";
import { embedBitsSpatial, embedByOrder, lsbCapacityBits } from "./stego";
import { chiSquaredSteganalysis, gammaQ, meanGradientAt, smoothFractionAt, sobelGradient } from "./chi";

describe("incomplete gamma", () => {
  it("matches the closed form for dof=2: Q(1, x) = e^-x", () => {
    for (const x of [0.5, 1, 2, 5, 10]) {
      expect(gammaQ(1, x)).toBeCloseTo(Math.exp(-x), 5);
    }
  });

  it("is a monotonically decreasing survival function", () => {
    let prev = gammaQ(5, 0);
    for (const x of [1, 2, 4, 8, 16]) {
      const cur = gammaQ(5, x);
      expect(cur).toBeLessThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe("chi-squared steganalysis", () => {
  const cover = createSampleImageData(256, 256, 37);

  it("reports ~0 probability of embedding for a clean cover", () => {
    expect(chiSquaredSteganalysis(cover).pEmbed).toBeLessThan(0.05);
  });

  it("reports high probability of embedding for a fully randomized carrier", () => {
    const cap = lsbCapacityBits(cover);
    const bits: number[] = [];
    for (let i = 0; i < cap; i += 1) {
      bits.push(Math.sin(i * 1.7) > 0 ? 1 : 0);
    }
    const stego = embedBitsSpatial(cover, bits).stego;
    expect(chiSquaredSteganalysis(stego).pEmbed).toBeGreaterThan(0.5);
  });

  it("stays blind to small partial payloads (the test's known limitation)", () => {
    const bits = Array.from({ length: 2000 }, (_, i) => i & 1);
    const stego = embedBitsSpatial(cover, bits).stego;
    expect(chiSquaredSteganalysis(stego).pEmbed).toBeLessThan(0.5);
  });

  // A pair with no samples contributes no term to the sum, so it is not a compared
  // category and must not be counted in the degrees of freedom. Hard-coding dof = 127
  // for a limited-palette image (screenshot, logo, cartoon, small crop) made clean
  // covers score Q(63.5, chi2/2) = 1.0 and print "LSB embedding detected, 100.00%".
  describe("limited-palette covers", () => {
    /** Greyscale carrier using only `pairs` value-pairs, each split (e+d, e-d). */
    function craft(pairs: number, e: number, d: number): ImageData {
      const samples: number[] = [];
      for (let k = 0; k < pairs; k += 1) {
        const v = 2 * (k + 40);
        for (let i = 0; i < e + d; i += 1) samples.push(v);
        for (let i = 0; i < e - d; i += 1) samples.push(v + 1);
      }
      const px = Math.ceil(samples.length / 3);
      const data = new Uint8ClampedArray(px * 4);
      for (let i = 0; i < samples.length; i += 1) {
        data[Math.floor(i / 3) * 4 + (i % 3)] = samples[i];
      }
      for (let p = 0; p < px; p += 1) data[p * 4 + 3] = 255;
      return new ImageData(data, px, 1);
    }

    it("counts only the pairs it actually compared as degrees of freedom", () => {
      for (const pairs of [4, 8, 16]) {
        expect(chiSquaredSteganalysis(craft(pairs, 768, 54)).dof).toBe(pairs - 1);
      }
    });

    it("does not flag a clean limited-palette cover as embedded", () => {
      for (const [pairs, e, d] of [
        [4, 1500, 60],
        [8, 768, 54],
        [8, 768, 60],
      ]) {
        expect(chiSquaredSteganalysis(craft(pairs, e, d)).pEmbed).toBeLessThan(0.5);
      }
    });

    it("never reports a degrees-of-freedom that would make gammaQ undefined", () => {
      const single = chiSquaredSteganalysis(craft(1, 900, 40));
      expect(single.dof).toBeGreaterThanOrEqual(1);
      expect(Number.isNaN(single.pEmbed)).toBe(false);
    });
  });
});

describe("adaptive placement metrics", () => {
  const cover = createSampleImageData(256, 256, 37);
  const gradient = sobelGradient(cover);
  const total = cover.width * cover.height;
  const bits = Array.from({ length: 1500 }, (_, i) => i & 1);

  function order(sortByTexture: boolean): Uint32Array {
    const o = new Uint32Array(total);
    for (let i = 0; i < total; i += 1) {
      o[i] = i;
    }
    if (sortByTexture) {
      o.sort((a, b) => gradient[b] - gradient[a]);
    }
    return o;
  }

  it("adaptive embeds in busier pixels than sequential", () => {
    const adapt = embedByOrder(cover, bits, order(true)).changed;
    const seq = embedByOrder(cover, bits, order(false)).changed;
    expect(meanGradientAt(gradient, adapt)).toBeGreaterThan(meanGradientAt(gradient, seq));
  });

  it("adaptive lands a smaller fraction of bits in smooth regions", () => {
    const adapt = embedByOrder(cover, bits, order(true)).changed;
    const seq = embedByOrder(cover, bits, order(false)).changed;
    expect(smoothFractionAt(gradient, adapt)).toBeLessThan(smoothFractionAt(gradient, seq));
  });
});
