// Image generation, conversion, and quality-metric helpers.
// Functions operate on the standard DOM ImageData shape; the constructor is only
// referenced inside function bodies so the module imports cleanly in any runtime.

export function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function pseudoNoise(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

export function cloneImageData(image: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

export function createSampleImageData(width: number, height: number, seed: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const t = y / height;
      const nx = x / width;
      const noise = pseudoNoise(x, y, seed);
      const hills = Math.sin(nx * Math.PI * 6) * 0.5 + 0.5;
      const skyMix = 0.58 - t;
      let r = clampByte(40 + 95 * hills + 30 * noise + 70 * Math.max(0, skyMix));
      let g = clampByte(65 + 110 * hills + 70 * t + 25 * noise);
      const b = clampByte(90 + 80 * t + 20 * noise + 80 * Math.max(0, skyMix));

      if (y > height * 0.58) {
        const texture = pseudoNoise(x * 2, y * 2, seed + 9) * 60;
        g = clampByte(g + texture);
        r = clampByte(r + texture * 0.3);
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

export function computeHistogram(image: ImageData): number[] {
  const hist = new Array<number>(256).fill(0);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    hist[d[i]] += 1;
    hist[d[i + 1]] += 1;
    hist[d[i + 2]] += 1;
  }
  return hist;
}

export function imageToLuma(image: ImageData): Float64Array {
  const luma = new Float64Array(image.width * image.height);
  for (let i = 0, p = 0; i < image.data.length; i += 4, p += 1) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    luma[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

export type DistortionMetrics = {
  mse: number;
  /** Peak signal-to-noise ratio in dB; Infinity when the images are identical. */
  psnr: number;
  /** Largest absolute per-channel change across the whole image. */
  maxDelta: number;
  /** Count of color channels (R/G/B) that changed value. */
  changedChannels: number;
};

/** Standard steganographic fidelity metrics between a cover and its stego counterpart. */
export function distortion(cover: ImageData, stego: ImageData): DistortionMetrics {
  const a = cover.data;
  const b = stego.data;
  let sumSq = 0;
  let count = 0;
  let maxDelta = 0;
  let changedChannels = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (i % 4 === 3) {
      continue; // skip the alpha channel
    }
    const d = a[i] - b[i];
    if (d !== 0) {
      changedChannels += 1;
    }
    const abs = Math.abs(d);
    if (abs > maxDelta) {
      maxDelta = abs;
    }
    sumSq += d * d;
    count += 1;
  }
  const mse = count === 0 ? 0 : sumSq / count;
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  return { mse, psnr, maxDelta, changedChannels };
}
