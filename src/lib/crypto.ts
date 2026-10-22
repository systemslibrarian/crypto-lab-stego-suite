// AES-256-GCM with PBKDF2 key derivation. Encrypt-then-embed is the strongest model:
// steganography hides existence, encryption protects content if the carrier is detected.
import { LSB_MODE_AES_GCM_LEGACY, LSB_MODE_AES_GCM_PBKDF2_600K } from "./bits";

const PBKDF2_ITERATIONS = 600_000;
const LEGACY_PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

type EncryptedMode = typeof LSB_MODE_AES_GCM_LEGACY | typeof LSB_MODE_AES_GCM_PBKDF2_600K;

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number, usage: "encrypt" | "decrypt") {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const saltBytes = Uint8Array.from(salt);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

export async function encryptAesGcm(message: string, passphrase: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesKey(passphrase, salt, PBKDF2_ITERATIONS, "encrypt");
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(message)));
  const packed = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.length);
  packed.set(salt, 0);
  packed.set(iv, SALT_BYTES);
  packed.set(ciphertext, SALT_BYTES + IV_BYTES);
  return packed;
}

export async function decryptAesGcm(payload: Uint8Array, passphrase: string, mode: EncryptedMode): Promise<string> {
  if (mode !== LSB_MODE_AES_GCM_LEGACY && mode !== LSB_MODE_AES_GCM_PBKDF2_600K) {
    throw new Error("Unsupported encrypted packet mode.");
  }
  if (payload.length < SALT_BYTES + IV_BYTES + 16) {
    throw new Error("Encrypted packet is too short.");
  }
  const decoder = new TextDecoder();
  const salt = payload.slice(0, SALT_BYTES);
  const iv = payload.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = payload.slice(SALT_BYTES + IV_BYTES);
  const iterations = mode === LSB_MODE_AES_GCM_LEGACY ? LEGACY_PBKDF2_ITERATIONS : PBKDF2_ITERATIONS;
  const key = await deriveAesKey(passphrase, salt, iterations, "decrypt");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plain);
}
