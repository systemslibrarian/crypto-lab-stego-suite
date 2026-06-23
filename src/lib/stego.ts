// Spatial-domain LSB embedding/extraction in the standard ImageData layout.

import { cloneImageData } from "./image";

export type FirstChange = {
  valueBefore: number;
  valueAfter: number;
  bit: number;
  x: number;
  y: number;
};

export function lsbCapacityBits(image: ImageData): number {
  return image.width * image.height * 3;
}

export function embedBitsSpatial(image: ImageData, bits: number[]): { stego: ImageData; firstChange: FirstChange | null } {
  const copy = cloneImageData(image);
  const data = copy.data;
  let bitIndex = 0;
  let firstChange: FirstChange | null = null;

  for (let i = 0; i < data.length && bitIndex < bits.length; i += 1) {
    if (i % 4 === 3) {
      continue;
    }
    const before = data[i];
    const bit = bits[bitIndex];
    const after = (before & 0xfe) | bit;
    data[i] = after;
    if (!firstChange && before !== after) {
      const px = Math.floor((i / 4) % image.width);
      const py = Math.floor(i / 4 / image.width);
      firstChange = { valueBefore: before, valueAfter: after, bit, x: px, y: py };
    }
    bitIndex += 1;
  }

  return { stego: copy, firstChange };
}

export function extractBitsSpatial(image: ImageData, bitCount: number): number[] {
  const bits: number[] = [];
  const data = image.data;
  for (let i = 0; i < data.length && bits.length < bitCount; i += 1) {
    if (i % 4 === 3) {
      continue;
    }
    bits.push(data[i] & 1);
  }
  return bits;
}

/** Embed bits into the blue channel of pixels visited in a caller-supplied order. */
export function embedByOrder(image: ImageData, bits: number[], order: Uint32Array): { stego: ImageData; changed: Uint32Array } {
  const copy = cloneImageData(image);
  const changed = new Uint32Array(bits.length);
  for (let i = 0; i < bits.length; i += 1) {
    const p = order[i];
    const idx = p * 4 + 2;
    copy.data[idx] = (copy.data[idx] & 0xfe) | bits[i];
    changed[i] = p;
  }
  return { stego: copy, changed };
}
