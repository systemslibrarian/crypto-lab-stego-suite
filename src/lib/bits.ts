// Pure bit/byte/packet codec helpers shared by every exhibit.
// No DOM dependencies so this module is unit-testable in isolation.

export function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const b of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push((b >> bit) & 1);
    }
  }
  return bits;
}

export function bitsToBytes(bits: number[]): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(bits.length / 8));
  for (let i = 0; i < bits.length; i += 1) {
    const byteIndex = Math.floor(i / 8);
    bytes[byteIndex] = (bytes[byteIndex] << 1) | bits[i];
    if (i % 8 === 7) {
      continue;
    }
    if (i === bits.length - 1) {
      bytes[byteIndex] <<= 7 - (i % 8);
    }
  }
  return bytes;
}

export function u32ToBytes(v: number): Uint8Array {
  return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
}

export function bytesToU32(bytes: Uint8Array, offset: number): number {
  // Final `>>> 0` keeps the result unsigned; a chained `|` would otherwise re-sign 0xFFFFFFFF to -1.
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function buildPacketBytes(body: Uint8Array): Uint8Array {
  const head = u32ToBytes(body.length);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, 4);
  return out;
}

export function parsePacketBytes(packet: Uint8Array): Uint8Array {
  const len = bytesToU32(packet, 0);
  return packet.slice(4, 4 + len);
}

export function makeLsbBody(mode: number, payload: Uint8Array): Uint8Array {
  const len = u32ToBytes(payload.length);
  const out = new Uint8Array(1 + 4 + payload.length);
  out[0] = mode;
  out.set(len, 1);
  out.set(payload, 5);
  return out;
}

export function parseLsbBody(body: Uint8Array): { mode: number; payload: Uint8Array } {
  const mode = body[0] ?? 0;
  const payloadLen = bytesToU32(body, 1);
  return { mode, payload: body.slice(5, 5 + payloadLen) };
}

export function encodeTextPacket(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  return bytesToBits(buildPacketBytes(bytes));
}

export function decodeTextPacket(bits: number[]): string {
  const packetLenBytes = bitsToBytes(bits.slice(0, 32));
  const packetLen = bytesToU32(packetLenBytes, 0);
  const totalBits = (packetLen + 4) * 8;
  const packetBytes = bitsToBytes(bits.slice(0, totalBits));
  const body = parsePacketBytes(packetBytes);
  return new TextDecoder().decode(body);
}

/** Total bytes a plaintext LSB packet occupies on the wire: 4 (len) + 1 (mode) + 4 (payload len) + payload. */
export function lsbPacketBytes(payloadBytes: number): number {
  return 4 + 1 + 4 + payloadBytes;
}

/** AES-GCM payload overhead: 16-byte salt + 12-byte IV + 16-byte GCM tag. */
export const AES_OVERHEAD_BYTES = 16 + 12 + 16;
