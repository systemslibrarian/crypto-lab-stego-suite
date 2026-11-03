// Carrier survival: what happens to an LSB payload when the carrier image is transformed.
//
// Hiding, detecting and destroying a message are different outcomes, and lossy processing of
// a carrier usually destroys subtle embedded changes (Wayner, Disappearing Cryptography, 3rd
// ed., section 9.5 and chapter 17). Every result here is a measurement on one image in one
// run. Nothing in this module predicts survival in general.

import { LSB_MODE_AES_GCM_LEGACY, LSB_MODE_AES_GCM_PBKDF2_600K, LSB_MODE_PLAIN, bitsToBytes, bytesToU32, parseLsbBody, parsePacketBytes } from "./bits";
import { decryptAesGcm } from "./crypto";
import { clampByte, cloneImageData, distortion } from "./image";
import { extractBitsSpatial, lsbCapacityBits } from "./stego";

export type SurvivalOutcome = "recovered" | "carrier failure" | "authentication failure" | "message altered";

export type CarrierAssessment = { outcome: SurvivalOutcome; detail: string };

export type SurvivalRow = {
  name: string;
  outcome: SurvivalOutcome;
  detail: string;
  /** Embedded bits read back wrongly from the transformed carrier, in the extractor's own order. */
  bitErrors: number;
  comparedBits: number;
  /** PSNR against the stego image in dB; null when the transformation changed the image size. */
  psnr: number | null;
  sizeNote: string | null;
};

export type Transform = { name: string; apply: (image: ImageData) => ImageData | Promise<ImageData> };

/** Compare the embedded bits with what an extractor reads from the same LSB slots now. */
export function payloadBitErrors(embedded: number[], image: ImageData): { errors: number; compared: number } {
  const compared = Math.min(embedded.length, lsbCapacityBits(image));
  const read = extractBitsSpatial(image, compared);
  let errors = embedded.length - compared;
  for (let i = 0; i < compared; i += 1) if (read[i] !== embedded[i]) errors += 1;
  return { errors, compared: embedded.length };
}

/**
 * Try to extract and open the packet, and say which stage failed. A damaged length header or
 * truncated packet is a carrier failure: there is nothing to decrypt. An encrypted packet that
 * parses but will not decrypt is an authentication failure: the structure survived far enough
 * for AES-GCM to reject the altered ciphertext.
 */
export async function assessCarrier(image: ImageData, expectedMessage: string, passphrase?: string): Promise<CarrierAssessment> {
  const capacity = lsbCapacityBits(image);
  const packetLen = bytesToU32(bitsToBytes(extractBitsSpatial(image, 32)), 0);
  if (packetLen <= 0 || (packetLen + 4) * 8 > capacity) {
    return { outcome: "carrier failure", detail: "The length header no longer describes a packet that fits this image." };
  }
  const body = parsePacketBytes(bitsToBytes(extractBitsSpatial(image, (packetLen + 4) * 8)));
  const parsed = parseLsbBody(body);
  if (parsed.payload.length + 5 > body.length) {
    return { outcome: "carrier failure", detail: "The packet header survived but the packet is malformed or truncated." };
  }
  if (parsed.mode === LSB_MODE_AES_GCM_LEGACY || parsed.mode === LSB_MODE_AES_GCM_PBKDF2_600K) {
    if (!passphrase) return { outcome: "carrier failure", detail: "An encrypted packet was found, but no passphrase was given to test it." };
    let message: string;
    try {
      message = await decryptAesGcm(parsed.payload, passphrase, parsed.mode);
    } catch {
      return { outcome: "authentication failure", detail: "The packet structure survived, but AES-GCM rejected the altered ciphertext." };
    }
    return message === expectedMessage
      ? { outcome: "recovered", detail: "The packet decrypted and matches the embedded message." }
      : { outcome: "message altered", detail: "The packet decrypted to a different message." };
  }
  if (parsed.mode !== LSB_MODE_PLAIN) {
    return { outcome: "carrier failure", detail: "The packet mode byte was altered." };
  }
  const message = new TextDecoder().decode(parsed.payload);
  return message === expectedMessage
    ? { outcome: "recovered", detail: "The extracted message matches the embedded message." }
    : { outcome: "message altered", detail: "A packet was extracted, but its text differs from the embedded message." };
}

/** Run each transformation on a copy of the stego image and measure what changed. */
export async function compareTransforms(stego: ImageData, embeddedBits: number[], message: string, passphrase: string | undefined, transforms: Transform[]): Promise<SurvivalRow[]> {
  const rows: SurvivalRow[] = [];
  for (const t of transforms) {
    const out = await t.apply(cloneImageData(stego));
    const sameSize = out.width === stego.width && out.height === stego.height;
    const { errors, compared } = payloadBitErrors(embeddedBits, out);
    const a = await assessCarrier(out, message, passphrase);
    rows.push({
      name: t.name,
      outcome: a.outcome,
      detail: a.detail,
      bitErrors: errors,
      comparedBits: compared,
      psnr: sameSize ? distortion(stego, out).psnr : null,
      sizeNote: sameSize ? null : `${stego.width}×${stego.height} → ${out.width}×${out.height}`
    });
  }
  return rows;
}

/** Remove columns from the left edge, as a crop would. */
export function cropLeft(image: ImageData, columns: number): ImageData {
  const w = image.width - columns, h = image.height;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    data.set(image.data.subarray((y * image.width + columns) * 4, (y * image.width + image.width) * 4), y * w * 4);
  }
  return new ImageData(data, w, h);
}

/** Bilinear resampling to a new size, as an image editor's resize would. */
export function scaleBilinear(image: ImageData, factor: number): ImageData {
  const w = Math.max(1, Math.round(image.width * factor)), h = Math.max(1, Math.round(image.height * factor));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(image.height - 1, (y + 0.5) / factor - 0.5);
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(image.height - 1, y0 + 1), fy = Math.max(0, sy - y0);
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(image.width - 1, (x + 0.5) / factor - 0.5);
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(image.width - 1, x0 + 1), fx = Math.max(0, sx - x0);
      for (let c = 0; c < 4; c += 1) {
        const p = (yy: number, xx: number) => image.data[(yy * image.width + xx) * 4 + c];
        const top = p(y0, x0) * (1 - fx) + p(y0, x1) * fx, bottom = p(y1, x0) * (1 - fx) + p(y1, x1) * fx;
        data[(y * w + x) * 4 + c] = clampByte(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return new ImageData(data, w, h);
}

/** Nudge a deterministic fraction of colour channels by ±1, as light noise or editing would. */
export function perturb(image: ImageData, fraction: number, seed: number): ImageData {
  const out = cloneImageData(image);
  let state = seed >>> 0 || 1;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < out.data.length; i += 1) {
    if (i % 4 === 3) continue;
    if (next() < fraction) out.data[i] = clampByte(out.data[i] + (next() < 0.5 ? -1 : 1));
  }
  return out;
}
