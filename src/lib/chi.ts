// Chi-squared LSB steganalysis (Westfeld & Pfitzmann, IH 1999) plus the Sobel
// texture map used by the adaptive-embedding exhibit. The p-value comes from a
// real incomplete-gamma implementation (Numerical Recipes style series/CF).

import { computeHistogram, imageToLuma } from "./image";

export type ChiResult = {
  chi2: number;
  /**
   * Westfeld–Pfitzmann probability of embedding = Q(dof/2, chi2/2), the goodness-of-fit
   * to the "pairs of values are equal" hypothesis that LSB randomization produces.
   * ≈1 means the carrier looks LSB-embedded; ≈0 means it looks like a natural cover.
   * (This is NOT a classic small-is-anomalous p-value — large means detected.)
   */
  pEmbed: number;
  dof: number;
};

export function chiSquaredSteganalysis(image: ImageData): ChiResult {
  const hist = computeHistogram(image);
  let chi2 = 0;
  for (let k = 0; k < 128; k += 1) {
    const a = hist[2 * k];
    const b = hist[2 * k + 1];
    const e = (a + b) / 2;
    if (e > 0) {
      chi2 += ((a - e) * (a - e)) / e;
      chi2 += ((b - e) * (b - e)) / e;
    }
  }
  const dof = 127;
  const pEmbed = gammaQ(dof / 2, chi2 / 2);
  return { chi2, pEmbed, dof };
}

/** Mean texture (Sobel gradient magnitude) at a set of pixel indices — the embedding sites. */
export function meanGradientAt(gradient: Float64Array, indices: Uint32Array): number {
  if (indices.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < indices.length; i += 1) {
    sum += gradient[indices[i]];
  }
  return sum / indices.length;
}

/** Fraction of embedding sites that fall in smooth regions (gradient below the global median). */
export function smoothFractionAt(gradient: Float64Array, indices: Uint32Array): number {
  if (indices.length === 0) {
    return 0;
  }
  const sorted = Float64Array.from(gradient).sort();
  const median = sorted[Math.floor(sorted.length / 2)];
  let below = 0;
  for (let i = 0; i < indices.length; i += 1) {
    if (gradient[indices[i]] < median) {
      below += 1;
    }
  }
  return below / indices.length;
}

export function gammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) {
    return Number.NaN;
  }
  if (x < a + 1) {
    return 1 - gammaPSeries(a, x);
  }
  return gammaQCF(a, x);
}

function gammaPSeries(a: number, x: number): number {
  const itmax = 100;
  const eps = 3e-7;
  let sum = 1 / a;
  let del = sum;
  let ap = a;
  for (let n = 1; n <= itmax; n += 1) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * eps) {
      return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
    }
  }
  return sum * Math.exp(-x + a * Math.log(x) - gammln(a));
}

function gammaQCF(a: number, x: number): number {
  const itmax = 100;
  const eps = 3e-7;
  const fpmin = 1e-30;
  let b = x + 1 - a;
  let c = 1 / fpmin;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= itmax; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) {
      d = fpmin;
    }
    c = b + an / c;
    if (Math.abs(c) < fpmin) {
      c = fpmin;
    }
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) {
      break;
    }
  }

  return Math.exp(-x + a * Math.log(x) - gammln(a)) * h;
}

export function gammln(xx: number): number {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.001208650973866179,
    -0.000005395239384953
  ];
  let x = xx - 1;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j += 1) {
    x += 1;
    ser += cof[j] / x;
  }
  return -tmp + Math.log(2.5066282746310005 * ser);
}

export function sobelGradient(image: ImageData): Float64Array {
  const w = image.width;
  const h = image.height;
  const luma = imageToLuma(image);
  const out = new Float64Array(w * h);
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let sx = 0;
      let sy = 0;
      let ki = 0;
      for (let j = -1; j <= 1; j += 1) {
        for (let i = -1; i <= 1; i += 1) {
          const v = luma[(y + j) * w + (x + i)];
          sx += v * gx[ki];
          sy += v * gy[ki];
          ki += 1;
        }
      }
      out[y * w + x] = Math.hypot(sx, sy);
    }
  }

  return out;
}
