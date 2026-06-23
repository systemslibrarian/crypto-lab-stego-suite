// AES-256-GCM with PBKDF2 key derivation. Encrypt-then-embed is the strongest model:
// steganography hides existence, encryption protects content if the carrier is detected.

const PBKDF2_ITERATIONS = 120_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export async function encryptAesGcm(message: string, passphrase: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(message)));
  const packed = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.length);
  packed.set(salt, 0);
  packed.set(iv, SALT_BYTES);
  packed.set(ciphertext, SALT_BYTES + IV_BYTES);
  return packed;
}

export async function decryptAesGcm(payload: Uint8Array, passphrase: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const salt = payload.slice(0, SALT_BYTES);
  const iv = payload.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = payload.slice(SALT_BYTES + IV_BYTES);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plain);
}
