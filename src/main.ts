type ChiResult = { chi2: number; pValue: number; dof: number };

type LsbPacket = {
  mode: "plain" | "encrypted";
  message: string;
  passphraseUsed: boolean;
};

const CANVAS_SIZE = 256;
const SAMPLE_SEED = 37;

const app = document.getElementById("app");
if (!app) {
  throw new Error("App container not found.");
}

app.innerHTML = `
  <main class="shell" id="main-content">
    <header class="hero" role="banner">
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode"><span aria-hidden="true">🌙</span></button>
      <h1>Stego Suite</h1>
      <p class="subtitle">
        The definitive browser-based educational steganography demo: LSB substitution, F5-inspired DCT embedding,
        WOW-inspired adaptive embedding, and real chi-squared steganalysis.
      </p>
      <small>Encryption hides content; steganography hides existence. Strongest model: encrypt first, then hide.</small>
    </header>

    <section class="exhibit" id="exhibit-1" aria-labelledby="exhibit-1-heading">
      <h2 id="exhibit-1-heading">Exhibit 1 — Steganography vs Cryptography: Two Different Goals</h2>
      <p>
        <strong>Cryptography</strong> transforms content into unreadable ciphertext: existence is visible, meaning is hidden.
        <strong>Steganography</strong> hides a payload inside a normal-looking medium: existence is hidden, not just content.
      </p>
      <div class="row">
        <div>
          <h3>Why both are needed</h3>
          <p>Encryption without steganography can still trigger suspicion. Steganography without encryption exposes plaintext if detected.</p>
          <p>Combined workflow: encrypt first, then embed.</p>
        </div>
        <div>
          <h3>Arms race</h3>
          <p>LSB substitution ↔ chi-squared steganalysis (Westfeld & Pfitzmann 1999).</p>
          <p>F5 JPEG steganography ↔ calibration-family attacks (Fridrich et al.).</p>
          <p>Adaptive embedding ↔ ML steganalyzers (for example SRNet-class systems).</p>
        </div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> steganography appears in digital watermarking, covert channels, printer tracking dots,
        and activist/journalist communications where message existence is itself sensitive.
      </div>
      <div class="table-wrap">
      <table>
        <thead>
          <tr><th scope="col">Vocabulary</th><th scope="col">Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td>Cover medium</td><td>Original image/audio/video before embedding.</td></tr>
          <tr><td>Stego medium</td><td>Output medium after embedding payload.</td></tr>
          <tr><td>Payload</td><td>Secret bits hidden in the cover.</td></tr>
          <tr><td>Embedding rate</td><td>Payload bits per pixel or coefficient.</td></tr>
          <tr><td>Detectability</td><td>How likely steganalysis identifies stego content.</td></tr>
        </tbody>
      </table>
      </div>
    </section>

    <section class="exhibit" id="exhibit-2" aria-labelledby="exhibit-2-heading">
      <h2 id="exhibit-2-heading">Exhibit 2 — LSB Substitution: The Simplest Technique</h2>
      <p>
        RGB channels are 8-bit values. Flipping the least-significant bit (LSB) changes a channel by at most 1,
        usually visually imperceptible. This demo embeds 1 bit per channel (3 bits per pixel).
      </p>
      <div class="row">
        <div>
          <label for="lsb-message">Secret message (max 200 chars)</label>
          <textarea id="lsb-message" maxlength="200">Steganography hides the existence of communication.</textarea>
        </div>
        <div>
          <label for="lsb-passphrase">Passphrase for optional AES-256-GCM</label>
          <input id="lsb-passphrase" type="password" placeholder="Optional passphrase" autocomplete="off" />
          <label for="lsb-encrypt"><input id="lsb-encrypt" type="checkbox" /> Encrypt before embedding (AES-256-GCM)</label>
        </div>
      </div>
      <div class="controls" role="toolbar" aria-label="LSB embedding controls">
        <button id="lsb-embed" type="button">Embed message</button>
        <button id="lsb-extract" type="button">Extract message</button>
        <button id="lsb-download" type="button">Download stego PNG</button>
      </div>
      <div class="stats" id="lsb-stats" aria-live="polite" role="status"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>Cover image</h4><canvas id="lsb-cover" width="256" height="256" role="img" aria-label="Cover image before steganographic embedding"></canvas></div>
        <div class="figure"><h4>Stego image</h4><canvas id="lsb-stego" width="256" height="256" role="img" aria-label="Stego image after LSB embedding"></canvas></div>
        <div class="figure"><h4>20× zoom (cover, 10×10 region)</h4><canvas id="lsb-zoom-cover" width="200" height="200" role="img" aria-label="Zoomed pixel view of cover image"></canvas></div>
        <div class="figure"><h4>20× zoom (stego, 10×10 region)</h4><canvas id="lsb-zoom-stego" width="200" height="200" role="img" aria-label="Zoomed pixel view of stego image"></canvas></div>
        <div class="figure"><h4>Histogram before</h4><canvas id="lsb-hist-cover" width="256" height="140" role="img" aria-label="Histogram of pixel values in cover image"></canvas></div>
        <div class="figure"><h4>Histogram after</h4><canvas id="lsb-hist-stego" width="256" height="140" role="img" aria-label="Histogram of pixel values in stego image"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> LSB can fool human vision but introduces measurable statistical artifacts.
        Visual similarity is not statistical similarity.
      </div>
    </section>

    <section class="exhibit" id="exhibit-3" aria-labelledby="exhibit-3-heading">
      <h2 id="exhibit-3-heading">Exhibit 3 — Chi-Squared Steganalysis: Detecting LSB</h2>
      <p>
        Westfeld &amp; Pfitzmann (IH 1999) pair-value test over (0,1), (2,3), ..., (254,255). LSB embedding tends to equalize each pair.
        This implementation computes a real chi-squared statistic and p-value with 127 degrees of freedom.
      </p>
      <div class="controls" role="toolbar" aria-label="Chi-squared test controls">
        <button id="chi-test-cover" type="button">Test cover image</button>
        <button id="chi-test-stego" type="button">Test stego image</button>
        <button id="chi-run-curve" type="button">Run payload detectability curve</button>
      </div>
      <div class="stats" id="chi-results" aria-live="polite" role="status"></div>
      <div class="figure"><h4>Chi-squared distribution (dof = 127)</h4><canvas id="chi-plot" width="640" height="220" role="img" aria-label="Chi-squared probability distribution with test statistic marker"></canvas></div>
      <div id="chi-curve" aria-live="polite"></div>
      <div class="callout">
        <strong>Why this matters:</strong> the test does not need the original cover image and runs quickly,
        which is why naive LSB has been considered weak for adversarial use since 1999.
      </div>
    </section>

    <section class="exhibit" id="exhibit-4" aria-labelledby="exhibit-4-heading">
      <h2 id="exhibit-4-heading">Exhibit 4 — DCT-Domain Steganography (F5-inspired)</h2>
      <p>
        JPEG steganography works in frequency coefficients. This browser demo performs an educational 8×8 DCT workflow on raw image data.
        <strong>Label:</strong> F5-inspired DCT embedding — not full F5 JPEG re-encoding.
      </p>
      <div class="row">
        <div>
          <label for="dct-message">Secret message for DCT embedding</label>
          <textarea id="dct-message" maxlength="160">Frequency-domain embedding changes AC coefficients by ±1.</textarea>
        </div>
        <div>
          <small>
            Full F5 (Westfeld, IH 2001) embeds in JPEG quantized DCT coefficients with matrix embedding.
            This demo uses non-zero AC coefficient parity in TypeScript for educational visualization.
          </small>
        </div>
      </div>
      <div class="controls" role="toolbar" aria-label="DCT embedding controls">
        <button id="dct-transform" type="button">DCT transform</button>
        <button id="dct-embed" type="button">Embed in DCT</button>
        <button id="dct-inverse" type="button">Inverse DCT</button>
        <button id="dct-extract" type="button">Extract message</button>
      </div>
      <div class="stats" id="dct-stats" aria-live="polite" role="status"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>DCT heatmap before</h4><canvas id="dct-before" width="240" height="240" role="img" aria-label="DCT coefficient heatmap before embedding"></canvas></div>
        <div class="figure"><h4>DCT heatmap after (modified highlighted)</h4><canvas id="dct-after" width="240" height="240" role="img" aria-label="DCT coefficient heatmap after embedding with changes highlighted"></canvas></div>
        <div class="figure"><h4>Spatial image after inverse DCT</h4><canvas id="dct-image" width="256" height="256" role="img" aria-label="Image reconstructed from inverse DCT"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> DCT-domain hiding is operationally important because JPEG dominates web imagery.
        Frequency-domain changes behave differently from simple pixel LSB edits.
      </div>
    </section>

    <section class="exhibit" id="exhibit-5" aria-labelledby="exhibit-5-heading">
      <h2 id="exhibit-5-heading">Exhibit 5 — Adaptive Steganography (WOW-inspired)</h2>
      <p>
        Educational simplification inspired by WOW (Holub & Fridrich, WIFS 2012): compute a texture map using Sobel gradients,
        then embed first in low-cost (high-texture) locations and avoid smooth regions.
      </p>
      <div class="row">
        <div>
          <label for="adapt-message">Adaptive payload text</label>
          <textarea id="adapt-message" maxlength="180">Embed in texture, avoid smooth sky and flat regions.</textarea>
        </div>
        <div>
          <small>
            Label: WOW-inspired adaptive embedding — educational simplification. Real WOW/S-UNIWARD uses richer distortion modeling.
          </small>
        </div>
      </div>
      <div class="controls" role="toolbar" aria-label="Adaptive embedding controls">
        <button id="adapt-map" type="button">Compute texture map</button>
        <button id="adapt-embed" type="button">Adaptive embed</button>
        <button id="adapt-seq" type="button">Sequential LSB embed</button>
        <button id="adapt-compare" type="button">Compare chi-squared detectability</button>
      </div>
      <div class="stats" id="adapt-stats" aria-live="polite" role="status"></div>
      <div class="canvas-grid">
        <div class="figure"><h4>Texture cost map (green low cost, red high cost)</h4><canvas id="adapt-map-canvas" width="256" height="256" role="img" aria-label="Texture cost map showing low-cost areas in green and high-cost in red"></canvas></div>
        <div class="figure"><h4>Adaptive embedding locations</h4><canvas id="adapt-locations" width="256" height="256" role="img" aria-label="Image showing where adaptive embedding placed payload bits"></canvas></div>
        <div class="figure"><h4>Sequential embedding locations</h4><canvas id="seq-locations" width="256" height="256" role="img" aria-label="Image showing where sequential embedding placed payload bits"></canvas></div>
      </div>
      <div class="callout">
        <strong>Why this matters:</strong> adaptive methods reduce detectability compared to naive sequential LSB,
        but modern ML steganalysis still detects many adaptive schemes at low payload rates.
      </div>
    </section>

    <section class="exhibit" id="exhibit-6" aria-labelledby="exhibit-6-heading">
      <h2 id="exhibit-6-heading">Exhibit 6 — Steganography in the Real World</h2>
      <div class="row">
        <div>
          <h3>Case A — Printer Tracking Dots</h3>
          <p>Invisible yellow dot patterns from major printers encode serial/time metadata; publicly documented by EFF (2005).</p>
          <p>Reality Winner (2017) was identified in part through printer dot metadata on leaked NSA material.</p>

          <h3>Case B — Digital Watermarking</h3>
          <p>Image/audio watermarking supports ownership and provenance workflows, including modern authenticity ecosystems such as C2PA.</p>

          <h3>Case C — Network Steganography</h3>
          <p>Covert channels can hide data in packet timing, sizes, or protocol fields (for example VoIP timing-channel techniques).</p>
        </div>
        <div>
          <h3>Case D — Malware C2</h3>
          <p>Some malware families have used media carriers for hidden command channels; defenders rely on behavioral and anomaly analysis.</p>

          <h3>Case E — Steganalysis Practice</h3>
          <p>Operational steganalysis uses statistical and ML pipelines; current research frontier remains adaptive embedding vs deep models.</p>

          <h3>Legal and Ethical Context</h3>
          <p>Steganography is dual-use: privacy-preserving for journalists/activists and potentially abused by adversaries.</p>
        </div>
      </div>
      <nav class="links" aria-label="Related demos">
        <a href="https://systemslibrarian.github.io/snow2/" target="_blank" rel="noreferrer">Snow 2 demo <span aria-hidden="true">↗</span></a>
        <a href="https://systemslibrarian.github.io/crypto-lab-shadow-vault/" target="_blank" rel="noreferrer">Shadow Vault demo <span aria-hidden="true">↗</span></a>
        <a href="https://systemslibrarian.github.io/crypto-compare/" target="_blank" rel="noreferrer">Crypto Compare reference <span aria-hidden="true">↗</span></a>
      </nav>
    </section>
  </main>
`;

function installThemeToggle(): void {
  const root = document.documentElement;
  const button = document.getElementById("theme-toggle") as HTMLButtonElement | null;
  if (!button) {
    return;
  }

  const sync = (): void => {
    const isDark = root.getAttribute("data-theme") !== "light";
    button.innerHTML = `<span aria-hidden="true">${isDark ? "🌙" : "☀️"}</span>`;
    button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  };

  sync();
  button.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    sync();
  });
}

function createSampleImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const t = y / height;
      const nx = x / width;
      const noise = pseudoNoise(x, y, SAMPLE_SEED);
      const hills = Math.sin(nx * Math.PI * 6) * 0.5 + 0.5;
      const skyMix = 0.58 - t;
      let r = clampByte(40 + 95 * hills + 30 * noise + 70 * Math.max(0, skyMix));
      let g = clampByte(65 + 110 * hills + 70 * t + 25 * noise);
      let b = clampByte(90 + 80 * t + 20 * noise + 80 * Math.max(0, skyMix));

      if (y > height * 0.58) {
        const texture = pseudoNoise(x * 2, y * 2, SAMPLE_SEED + 9) * 60;
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

function pseudoNoise(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function getCtx(id: string): CanvasRenderingContext2D {
  const canvas = document.getElementById(id) as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error(`Canvas not found: ${id}`);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(`2D context unavailable: ${id}`);
  }
  return ctx;
}

function drawImageData(ctx: CanvasRenderingContext2D, image: ImageData): void {
  ctx.putImageData(image, 0, 0);
}

function cloneImageData(image: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
}

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (const b of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      bits.push((b >> bit) & 1);
    }
  }
  return bits;
}

function bitsToBytes(bits: number[]): Uint8Array {
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

function u32ToBytes(v: number): Uint8Array {
  return new Uint8Array([(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
}

function bytesToU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function buildPacketBytes(body: Uint8Array): Uint8Array {
  const head = u32ToBytes(body.length);
  const out = new Uint8Array(head.length + body.length);
  out.set(head, 0);
  out.set(body, 4);
  return out;
}

function parsePacketBytes(packet: Uint8Array): Uint8Array {
  const len = bytesToU32(packet, 0);
  return packet.slice(4, 4 + len);
}

function makeLsbBody(mode: number, payload: Uint8Array): Uint8Array {
  const len = u32ToBytes(payload.length);
  const out = new Uint8Array(1 + 4 + payload.length);
  out[0] = mode;
  out.set(len, 1);
  out.set(payload, 5);
  return out;
}

function parseLsbBody(body: Uint8Array): { mode: number; payload: Uint8Array } {
  const mode = body[0] ?? 0;
  const payloadLen = bytesToU32(body, 1);
  return { mode, payload: body.slice(5, 5 + payloadLen) };
}

function lsbCapacityBits(image: ImageData): number {
  return image.width * image.height * 3;
}

function embedBitsSpatial(
  image: ImageData,
  bits: number[]
): { stego: ImageData; firstChange: { valueBefore: number; valueAfter: number; bit: number; x: number; y: number } | null } {
  const copy = cloneImageData(image);
  const data = copy.data;
  let bitIndex = 0;
  let firstChange: { valueBefore: number; valueAfter: number; bit: number; x: number; y: number } | null = null;

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

function extractBitsSpatial(image: ImageData, bitCount: number): number[] {
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

async function encryptAesGcm(message: string, passphrase: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(message)));
  const packed = new Uint8Array(16 + 12 + ciphertext.length);
  packed.set(salt, 0);
  packed.set(iv, 16);
  packed.set(ciphertext, 28);
  return packed;
}

async function decryptAesGcm(payload: Uint8Array, passphrase: string): Promise<string> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const salt = payload.slice(0, 16);
  const iv = payload.slice(16, 28);
  const ciphertext = payload.slice(28);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plain);
}

function drawZoom(source: ImageData, targetCanvasId: string, startX: number, startY: number): void {
  const targetCtx = getCtx(targetCanvasId);
  const size = 10;
  const temp = document.createElement("canvas");
  temp.width = size;
  temp.height = size;
  const tempCtx = temp.getContext("2d");
  if (!tempCtx) {
    return;
  }

  const region = new ImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const srcX = Math.min(source.width - 1, startX + x);
      const srcY = Math.min(source.height - 1, startY + y);
      const srcI = (srcY * source.width + srcX) * 4;
      const dstI = (y * size + x) * 4;
      region.data[dstI] = source.data[srcI];
      region.data[dstI + 1] = source.data[srcI + 1];
      region.data[dstI + 2] = source.data[srcI + 2];
      region.data[dstI + 3] = 255;
    }
  }

  tempCtx.putImageData(region, 0, 0);
  targetCtx.clearRect(0, 0, 200, 200);
  targetCtx.imageSmoothingEnabled = false;
  targetCtx.drawImage(temp, 0, 0, 200, 200);
}

function computeHistogram(image: ImageData): number[] {
  const hist = new Array<number>(256).fill(0);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    hist[d[i]] += 1;
    hist[d[i + 1]] += 1;
    hist[d[i + 2]] += 1;
  }
  return hist;
}

function drawHistogram(hist: number[], canvasId: string): void {
  const ctx = getCtx(canvasId);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...hist, 1);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "currentColor";
  for (let i = 0; i < 256; i += 1) {
    const x = (i / 256) * w;
    const barH = (hist[i] / max) * (h - 8);
    ctx.fillRect(x, h - barH, Math.max(1, w / 256), barH);
  }
}

function chiSquaredSteganalysis(image: ImageData): ChiResult {
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
  const pValue = gammaQ(dof / 2, chi2 / 2);
  return { chi2, pValue, dof };
}

function gammaQ(a: number, x: number): number {
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

function gammln(xx: number): number {
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

function drawChiPlot(canvasId: string, chi2: number, dof: number): void {
  const ctx = getCtx(canvasId);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const maxX = dof * 2.5;
  const step = maxX / w;
  const pdf = (x: number): number => {
    if (x <= 0) {
      return 0;
    }
    const k = dof / 2;
    const log = (k - 1) * Math.log(x) - x / 2 - k * Math.log(2) - gammln(k);
    return Math.exp(log);
  };

  let peak = 0;
  for (let x = 0.001; x <= maxX; x += step) {
    peak = Math.max(peak, pdf(x));
  }

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim() || "currentColor";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px < w; px += 1) {
    const x = px * step;
    const y = h - (pdf(x) / peak) * (h - 20) - 10;
    if (px === 0) {
      ctx.moveTo(px, y);
    } else {
      ctx.lineTo(px, y);
    }
  }
  ctx.stroke();

  const markerX = Math.max(0, Math.min(w - 1, (chi2 / maxX) * w));
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "currentColor";
  ctx.beginPath();
  ctx.moveTo(markerX, 8);
  ctx.lineTo(markerX, h - 8);
  ctx.stroke();
}

function imageToLuma(image: ImageData): Float64Array {
  const luma = new Float64Array(image.width * image.height);
  for (let i = 0, p = 0; i < image.data.length; i += 4, p += 1) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    luma[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

function dct2(block: number[][]): number[][] {
  const out = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  for (let u = 0; u < 8; u += 1) {
    for (let v = 0; v < 8; v += 1) {
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      let sum = 0;
      for (let x = 0; x < 8; x += 1) {
        for (let y = 0; y < 8; y += 1) {
          sum +=
            block[y][x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / 16) *
            Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[v][u] = 0.25 * cu * cv * sum;
    }
  }
  return out;
}

function idct2(coeff: number[][]): number[][] {
  const out = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let sum = 0;
      for (let u = 0; u < 8; u += 1) {
        for (let v = 0; v < 8; v += 1) {
          const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
          const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
          sum +=
            cu *
            cv *
            coeff[v][u] *
            Math.cos(((2 * x + 1) * u * Math.PI) / 16) *
            Math.cos(((2 * y + 1) * v * Math.PI) / 16);
        }
      }
      out[y][x] = 0.25 * sum;
    }
  }
  return out;
}

const zigzag: Array<[number, number]> = [
  [0, 1], [1, 0], [2, 0], [1, 1], [0, 2], [0, 3], [1, 2], [2, 1], [3, 0], [4, 0], [3, 1], [2, 2], [1, 3],
  [0, 4], [0, 5], [1, 4], [2, 3], [3, 2], [4, 1], [5, 0], [6, 0], [5, 1], [4, 2], [3, 3], [2, 4], [1, 5],
  [0, 6], [0, 7], [1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1], [7, 0], [7, 1], [6, 2], [5, 3], [4, 4],
  [3, 5], [2, 6], [1, 7], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [7, 3], [6, 4], [5, 5], [4, 6],
  [3, 7], [4, 7], [5, 6], [6, 5], [7, 4], [7, 5], [6, 6], [5, 7], [6, 7], [7, 6], [7, 7]
];

type DctState = {
  blocks: number[][][];
  blocksX: number;
  blocksY: number;
  width: number;
  height: number;
  modified: Set<string>;
  embedded: boolean;
};

function computeDctBlocks(image: ImageData): DctState {
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

function embedBitsDct(state: DctState, bits: number[]): number {
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

function extractBitsDct(state: DctState, bitCount: number): number[] {
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

function renderDctToImage(state: DctState): ImageData {
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

function drawDctHeatmap(canvasId: string, coeff: number[][], modified: Set<string>, blockIndex: number): void {
  const ctx = getCtx(canvasId);
  const w = ctx.canvas.width;
  const cell = Math.floor(w / 8);
  let maxAbs = 1;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      maxAbs = Math.max(maxAbs, Math.abs(coeff[y][x]));
    }
  }

  ctx.clearRect(0, 0, w, w);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const m = Math.abs(coeff[y][x]) / maxAbs;
      const light = Math.round(25 + m * 70);
      ctx.fillStyle = `hsl(200 70% ${light}%)`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      const key = `${blockIndex}:${x}:${y}`;
      ctx.strokeStyle = modified.has(key)
        ? getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "currentColor"
        : getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "currentColor";
      ctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }
}

function sobelGradient(image: ImageData): Float64Array {
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

function drawCostMap(gradient: Float64Array, image: ImageData, canvasId: string): void {
  const ctx = getCtx(canvasId);
  const w = image.width;
  const h = image.height;
  const out = new ImageData(w, h);
  let max = 1;
  for (const g of gradient) {
    if (g > max) {
      max = g;
    }
  }

  for (let i = 0; i < gradient.length; i += 1) {
    const t = gradient[i] / max;
    const red = clampByte((1 - t) * 230);
    const green = clampByte(t * 220);
    const baseIdx = i * 4;
    out.data[baseIdx] = red;
    out.data[baseIdx + 1] = green;
    out.data[baseIdx + 2] = 70;
    out.data[baseIdx + 3] = 220;
  }

  ctx.putImageData(out, 0, 0);
}

function embedByOrder(image: ImageData, bits: number[], order: Uint32Array): { stego: ImageData; changed: Uint32Array } {
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

function drawLocations(base: ImageData, changed: Uint32Array, canvasId: string): void {
  const ctx = getCtx(canvasId);
  ctx.putImageData(base, 0, 0);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--danger").trim() || "currentColor";
  for (let i = 0; i < changed.length; i += 1) {
    const p = changed[i];
    const x = p % base.width;
    const y = Math.floor(p / base.width);
    ctx.fillRect(x, y, 1, 1);
  }
}

function encodeTextPacket(text: string): number[] {
  const bytes = new TextEncoder().encode(text);
  return bytesToBits(buildPacketBytes(bytes));
}

function decodeTextPacket(bits: number[]): string {
  const packetLenBytes = bitsToBytes(bits.slice(0, 32));
  const packetLen = bytesToU32(packetLenBytes, 0);
  const totalBits = (packetLen + 4) * 8;
  const packetBytes = bitsToBytes(bits.slice(0, totalBits));
  const body = parsePacketBytes(packetBytes);
  return new TextDecoder().decode(body);
}

let lsbHasEmbedded = false;
let dctHasEmbedded = false;
let adaptHasEmbedded = false;
let seqHasEmbedded = false;

const coverImage = createSampleImageData(CANVAS_SIZE, CANVAS_SIZE);
let lsbStegoImage = cloneImageData(coverImage);
let dctState = computeDctBlocks(coverImage);
let dctStegoImage = cloneImageData(coverImage);
let adaptiveGradient = sobelGradient(coverImage);
let adaptiveStego = cloneImageData(coverImage);
let sequentialStego = cloneImageData(coverImage);

const lsbCoverCtx = getCtx("lsb-cover");
const lsbStegoCtx = getCtx("lsb-stego");
drawImageData(lsbCoverCtx, coverImage);
drawImageData(lsbStegoCtx, lsbStegoImage);
drawZoom(coverImage, "lsb-zoom-cover", 80, 80);
drawZoom(lsbStegoImage, "lsb-zoom-stego", 80, 80);
drawHistogram(computeHistogram(coverImage), "lsb-hist-cover");
drawHistogram(computeHistogram(lsbStegoImage), "lsb-hist-stego");

const dctImageCtx = getCtx("dct-image");
drawImageData(dctImageCtx, dctStegoImage);
drawCostMap(adaptiveGradient, coverImage, "adapt-map-canvas");
drawLocations(coverImage, new Uint32Array(0), "adapt-locations");
drawLocations(coverImage, new Uint32Array(0), "seq-locations");

drawChiPlot("chi-plot", 127, 127);

const lsbStats = document.getElementById("lsb-stats") as HTMLDivElement;
const chiResults = document.getElementById("chi-results") as HTMLDivElement;
const chiCurve = document.getElementById("chi-curve") as HTMLDivElement;
const dctStats = document.getElementById("dct-stats") as HTMLDivElement;
const adaptStats = document.getElementById("adapt-stats") as HTMLDivElement;

(document.getElementById("lsb-embed") as HTMLButtonElement).addEventListener("click", async () => {
  const message = (document.getElementById("lsb-message") as HTMLTextAreaElement).value;
  const encrypt = (document.getElementById("lsb-encrypt") as HTMLInputElement).checked;
  const passphrase = (document.getElementById("lsb-passphrase") as HTMLInputElement).value;

  if (!message) {
    lsbStats.innerHTML = `<span class="status-warn">Provide a message first.</span>`;
    return;
  }

  if (encrypt && !passphrase) {
    lsbStats.innerHTML = `<span class="status-warn">Encryption selected: passphrase is required.</span>`;
    return;
  }

  const plainBytes = new TextEncoder().encode(message);
  const payload = encrypt ? await encryptAesGcm(message, passphrase) : plainBytes;
  const body = makeLsbBody(encrypt ? 1 : 0, payload);
  const packet = buildPacketBytes(body);
  const bits = bytesToBits(packet);
  const capacity = lsbCapacityBits(coverImage);

  if (bits.length > capacity) {
    lsbStats.innerHTML = `<span class="status-warn">Payload too large: ${bits.length} bits required, ${capacity} bits available.</span>`;
    return;
  }

  const result = embedBitsSpatial(coverImage, bits);
  lsbStegoImage = result.stego;
  lsbHasEmbedded = true;
  drawImageData(lsbStegoCtx, lsbStegoImage);
  drawZoom(lsbStegoImage, "lsb-zoom-stego", 80, 80);
  drawHistogram(computeHistogram(lsbStegoImage), "lsb-hist-stego");

  const info = result.firstChange
    ? `Pixel (${result.firstChange.x}, ${result.firstChange.y}) channel before ${result.firstChange.valueBefore} (LSB ${result.firstChange.valueBefore & 1}), after ${result.firstChange.valueAfter} (LSB ${result.firstChange.valueAfter & 1}), payload bit ${result.firstChange.bit}.`
    : "No first-change sample available (all initial bits matched existing LSBs).";

  lsbStats.innerHTML = `
    <div>Payload: ${plainBytes.length} bytes plaintext, ${payload.length} bytes stored. Capacity: ${(capacity / 8).toFixed(0)} bytes.</div>
    <div>Mode: ${encrypt ? "AES-256-GCM then steganography" : "Plaintext steganography"}.</div>
    <div>${info}</div>
  `;
});

(document.getElementById("lsb-extract") as HTMLButtonElement).addEventListener("click", async () => {
  if (!lsbHasEmbedded) {
    lsbStats.innerHTML = `<span class="status-warn">No message embedded yet. Embed a message first.</span>`;
    return;
  }
  const headerBits = extractBitsSpatial(lsbStegoImage, 32);
  const packetLenBytes = bitsToBytes(headerBits);
  const packetLen = bytesToU32(packetLenBytes, 0);
  const totalBits = (packetLen + 4) * 8;
  const bits = extractBitsSpatial(lsbStegoImage, totalBits);
  const packet = bitsToBytes(bits);
  const body = parsePacketBytes(packet);
  const parsed = parseLsbBody(body);

  let message = "";
  let mode: LsbPacket["mode"] = "plain";
  let passphraseUsed = false;

  if (parsed.mode === 1) {
    mode = "encrypted";
    const passphrase = (document.getElementById("lsb-passphrase") as HTMLInputElement).value;
    if (!passphrase) {
      lsbStats.innerHTML = `<span class="status-warn">Encrypted payload found: enter passphrase to decrypt.</span>`;
      return;
    }
    passphraseUsed = true;
    try {
      message = await decryptAesGcm(parsed.payload, passphrase);
    } catch {
      lsbStats.innerHTML = `<span class="status-warn">Decryption failed. Check passphrase.</span>`;
      return;
    }
  } else {
    message = new TextDecoder().decode(parsed.payload);
  }

  const packetInfo: LsbPacket = { mode, message, passphraseUsed };
  lsbStats.innerHTML = `Recovered: <strong>${escapeHtml(packetInfo.message)}</strong><br/>Mode: ${packetInfo.mode}${
    packetInfo.passphraseUsed ? " (passphrase used)" : ""
  }`;
});

(document.getElementById("lsb-download") as HTMLButtonElement).addEventListener("click", () => {
  const c = document.createElement("canvas");
  c.width = lsbStegoImage.width;
  c.height = lsbStegoImage.height;
  const ctx = c.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.putImageData(lsbStegoImage, 0, 0);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = "stego-lsb.png";
  a.click();
});

(document.getElementById("chi-test-cover") as HTMLButtonElement).addEventListener("click", () => {
  const res = chiSquaredSteganalysis(coverImage);
  drawChiPlot("chi-plot", res.chi2, res.dof);
  const detected = res.pValue < 0.05;
  chiResults.innerHTML = `
    Cover test: χ²=${res.chi2.toFixed(2)}, p=${res.pValue.toExponential(3)}
    <span class="${detected ? "status-warn" : "status-ok"}">${detected ? "✗ Steganography likely present" : "✓ No steganography detected"}</span>
  `;
});

(document.getElementById("chi-test-stego") as HTMLButtonElement).addEventListener("click", () => {
  if (!lsbHasEmbedded) {
    chiResults.innerHTML = `<span class="status-warn">No LSB embedding done yet. Embed a message in Exhibit 2 first.</span>`;
    return;
  }
  const res = chiSquaredSteganalysis(lsbStegoImage);
  drawChiPlot("chi-plot", res.chi2, res.dof);
  const detected = res.pValue < 0.05;
  chiResults.innerHTML = `
    Stego test: χ²=${res.chi2.toFixed(2)}, p=${res.pValue.toExponential(3)}
    <span class="${detected ? "status-warn" : "status-ok"}">${detected ? "✗ Steganography likely present" : "✓ No steganography detected"}</span>
  `;
});

(document.getElementById("chi-run-curve") as HTMLButtonElement).addEventListener("click", () => {
  const rates = [0.1, 0.5, 1.0];
  const capacity = lsbCapacityBits(coverImage);
  const rows = rates.map((r) => {
    const bitCount = Math.floor(capacity * r);
    const randomBytes = crypto.getRandomValues(new Uint8Array(Math.ceil(bitCount / 8)));
    const bits = bytesToBits(randomBytes).slice(0, bitCount);
    const stego = embedBitsSpatial(coverImage, bits).stego;
    const res = chiSquaredSteganalysis(stego);
    return `<tr><td>${Math.round(r * 100)}%</td><td>${bitCount.toLocaleString()}</td><td>${res.chi2.toFixed(2)}</td><td>${res.pValue.toExponential(3)}</td></tr>`;
  });
  chiCurve.innerHTML = `<div class="table-wrap"><table><thead><tr><th scope="col">Payload rate</th><th scope="col">Bits</th><th scope="col">χ²</th><th scope="col">p-value</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
});

(document.getElementById("dct-transform") as HTMLButtonElement).addEventListener("click", () => {
  dctState = computeDctBlocks(coverImage);
  drawDctHeatmap("dct-before", dctState.blocks[0], new Set<string>(), 0);
  dctStats.innerHTML = "Computed 8×8 block DCT over the image. Showing block 0 heatmap.";
});

(document.getElementById("dct-embed") as HTMLButtonElement).addEventListener("click", () => {
  const message = (document.getElementById("dct-message") as HTMLTextAreaElement).value;
  const bits = encodeTextPacket(message);
  dctState = computeDctBlocks(coverImage);
  const written = embedBitsDct(dctState, bits);
  dctHasEmbedded = dctState.embedded;
  drawDctHeatmap("dct-before", computeDctBlocks(coverImage).blocks[0], new Set<string>(), 0);
  drawDctHeatmap("dct-after", dctState.blocks[0], dctState.modified, 0);
  dctStats.innerHTML = `Embedded ${written} bits into non-zero AC coefficients with ±1 coefficient edits. ${
    dctState.embedded ? "Complete payload embedded." : "Capacity reached before full payload."
  }`;
});

(document.getElementById("dct-inverse") as HTMLButtonElement).addEventListener("click", () => {
  dctStegoImage = renderDctToImage(dctState);
  drawImageData(dctImageCtx, dctStegoImage);
  dctStats.innerHTML += " Inverse DCT rendered to spatial-domain image.";
});

(document.getElementById("dct-extract") as HTMLButtonElement).addEventListener("click", () => {
  if (!dctHasEmbedded) {
    dctStats.innerHTML = `<span class="status-warn">No message embedded in DCT yet. Embed first.</span>`;
    return;
  }
  const head = extractBitsDct(dctState, 32);
  const packetLen = bytesToU32(bitsToBytes(head), 0);
  const total = (packetLen + 4) * 8;
  const bits = extractBitsDct(dctState, total);
  const message = decodeTextPacket(bits);
  dctStats.innerHTML = `Recovered from DCT coefficient stream: <strong>${escapeHtml(message)}</strong>`;
});

(document.getElementById("adapt-map") as HTMLButtonElement).addEventListener("click", () => {
  adaptiveGradient = sobelGradient(coverImage);
  drawCostMap(adaptiveGradient, coverImage, "adapt-map-canvas");
  adaptStats.innerHTML = "Texture map computed via Sobel gradient magnitude. High texture = lower embedding cost.";
});

(document.getElementById("adapt-embed") as HTMLButtonElement).addEventListener("click", () => {
  const message = (document.getElementById("adapt-message") as HTMLTextAreaElement).value;
  const bits = encodeTextPacket(message);
  const totalPixels = coverImage.width * coverImage.height;
  if (bits.length > totalPixels) {
    adaptStats.innerHTML = `<span class="status-warn">Payload too large for adaptive blue-channel carrier.</span>`;
    return;
  }
  const order = new Uint32Array(totalPixels);
  for (let i = 0; i < totalPixels; i += 1) {
    order[i] = i;
  }
  order.sort((a, b) => adaptiveGradient[b] - adaptiveGradient[a]);
  const { stego, changed } = embedByOrder(coverImage, bits, order);
  adaptiveStego = stego;
  adaptHasEmbedded = true;
  drawLocations(coverImage, changed, "adapt-locations");
  adaptStats.innerHTML = `Adaptive embedding wrote ${bits.length} bits, clustered in textured regions first.`;
});

(document.getElementById("adapt-seq") as HTMLButtonElement).addEventListener("click", () => {
  const message = (document.getElementById("adapt-message") as HTMLTextAreaElement).value;
  const bits = encodeTextPacket(message);
  const totalPixels = coverImage.width * coverImage.height;
  if (bits.length > totalPixels) {
    adaptStats.innerHTML = `<span class="status-warn">Payload too large for sequential baseline.</span>`;
    return;
  }
  const order = new Uint32Array(totalPixels);
  for (let i = 0; i < totalPixels; i += 1) {
    order[i] = i;
  }
  const { stego, changed } = embedByOrder(coverImage, bits, order);
  sequentialStego = stego;
  seqHasEmbedded = true;
  drawLocations(coverImage, changed, "seq-locations");
  adaptStats.innerHTML += " Sequential baseline plotted for comparison.";
});

(document.getElementById("adapt-compare") as HTMLButtonElement).addEventListener("click", () => {
  if (!adaptHasEmbedded || !seqHasEmbedded) {
    adaptStats.innerHTML = `<span class="status-warn">Run both adaptive and sequential embedding first.</span>`;
    return;
  }
  const adaptive = chiSquaredSteganalysis(adaptiveStego);
  const seq = chiSquaredSteganalysis(sequentialStego);
  adaptStats.innerHTML = `Same payload, different placement: sequential p=${seq.pValue.toExponential(3)}, adaptive p=${adaptive.pValue.toExponential(
    3
  )}. Higher p-value indicates reduced detectability, not invisibility.`;
});

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

installThemeToggle();
