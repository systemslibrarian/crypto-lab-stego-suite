// Educational 8x8 DCT-domain embedding (F5-inspired ±1 AC-coefficient parity).
// Not full F5 JPEG re-encoding; it visualizes frequency-domain hiding on raw image data.

import { clampByte, imageToLuma } from "./image";

export type DctState = {
  blocks: number[][][];
  blocksX: number;
  blocksY: number;
  width: number;
  height: number;
  modified: Set<string>;
  embedded: boolean;
};

export const zigzag: Array<[number, number]> = [
  [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2], [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3],
  [0, 4], [0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2], [3, 3], [2, 4], [1, 5],
  [0, 6], [0, 7], [1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
  [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [7, 3], [6, 4], [5, 5], [4, 6],
  [3, 7], [4, 7], [5, 6], [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
];

export function dct2(block: number[][]): number[][] {
  const out = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  for (let u = 0; u < 8; u += 1) {
    for (let v = 0; v < 8; v += 1) {
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      let sum = 0;
      for (let x = 0; x < 8; x += 1) {
        for (let y = 0; y < 8; y += 1) {
          sum += block[y][x] * Math.cos(((2 * x + 1) * u * Math.PI) / 16) * Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[v][u] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

export function idct2(coeff: number[][]): number[][] {
  const out = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let sum = 0;
      for (let u = 0; u < 8; u += 1) {
        for (let v = 0; v < 8; v += 1) {
          const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
          const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
          sum += cu * cv * coeff[v][u] * Math.cos(((2 * x + 1) * u * Math.PI) / 16) * Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[y][x] = 0.25 * sum;
    }
  }
  return out;
}

export function computeDctBlocks(image: ImageData): DctState {
  const luma = imageToLuma(image);
  const blocksX = Math.floor(image.width / 8);
  const blocksY = Math.floor(image.height / 8);
  const blocks: number[][][] = [];

  for (let by = 0; by < blocksY; by += 1) {
    for (let bx = 0; bx < blocksX; bx += 1) {
      const block = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const px = bx * 8 + x;
          const py = by * 8 + y;
          block[y][x] = luma[py * image.width + px] - 128;
        }
      }
      blocks.push(dct2(block));
    }
  }

  return { blocks, blocksX, blocksY, width: image.width, height: image.height, modified: new Set(), embedded: false };
}

export function embedBitsDct(state: DctState, bits: number[]): number {
  let bitIndex = 0;
  state.modified.clear();

  for (let bi = 0; bi < state.blocks.length && bitIndex < bits.length; bi += 1) {
    const block = state.blocks[bi];
    for (const [x, y] of zigzag) {
      if (bitIndex >= bits.length) {
        break;
      }
      let c = Math.round(block[y][x]);
      if (c === 0) {
        continue;
      }
      const desired = bits[bitIndex];
      const parity = Math.abs(c) % 2;
      if (parity !== desired) {
        c = c > 0 ? c + 1 : c - 1;
        if (c === 0) {
          c = desired === 1 ? 1 : -1;
        }
        block[y][x] = c;
        state.modified.add(`${bi}:${x}:${y}`);
      }
      bitIndex += 1;
    }
  }

  state.embedded = bitIndex === bits.length;
  return bitIndex;
}

export function extractBitsDct(state: DctState, bitCount: number): number[] {
  const bits: number[] = [];
  for (let bi = 0; bi < state.blocks.length && bits.length < bitCount; bi += 1) {
    const block = state.blocks[bi];
    for (const [x, y] of zigzag) {
      if (bits.length >= bitCount) {
        break;
      }
      const c = Math.round(block[y][x]);
      if (c === 0) {
        continue;
      }
      bits.push(Math.abs(c) % 2);
    }
  }
  return bits;
}

export function renderDctToImage(state: DctState): ImageData {
  const out = new ImageData(state.width, state.height);
  let bi = 0;
  for (let by = 0; by < state.blocksY; by += 1) {
    for (let bx = 0; bx < state.blocksX; bx += 1) {
      const spatial = idct2(state.blocks[bi]);
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const px = bx * 8 + x;
          const py = by * 8 + y;
          const idx = (py * state.width + px) * 4;
          const v = clampByte(spatial[y][x] + 128);
          out.data[idx] = v;
          out.data[idx + 1] = v;
          out.data[idx + 2] = v;
          out.data[idx + 3] = 255;
        }
      }
      bi += 1;
    }
  }
  return out;
}
