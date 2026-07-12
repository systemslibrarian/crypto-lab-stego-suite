import {
  AES_OVERHEAD_BYTES,
  bitsToBytes,
  bytesToBits,
  bytesToU32,
  buildPacketBytes,
  decodeTextPacket,
  encodeTextPacket,
  lsbPacketBytes,
  makeLsbBody,
  parseLsbBody,
  parsePacketBytes
} from "./lib/bits";
import { decryptAesGcm, encryptAesGcm } from "./lib/crypto";
import {
  cloneImageData,
  computeHistogram,
  createSampleImageData,
  distortion
} from "./lib/image";
import {
  embedBitsSpatial,
  embedByOrder,
  extractBitsSpatial,
  lsbCapacityBits
} from "./lib/stego";
import {
  computeDctBlocks,
  embedBitsDct,
  extractBitsDct,
  renderDctToImage,
  type DctState
} from "./lib/dct";
import { chiSquaredSteganalysis, meanGradientAt, smoothFractionAt, sobelGradient } from "./lib/chi";

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
    <header class="cl-hero">
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode"><span aria-hidden="true">🌙</span></button>
      <div class="cl-hero-main">
        <h1 class="cl-hero-title">Stego Suite</h1>
        <p class="cl-hero-sub">LSB · DCT · Adaptive embedding · Chi-squared steganalysis</p>
        <p class="cl-hero-desc">
          Embed secret messages in an image with LSB, F5-inspired DCT, and WOW-inspired adaptive methods, then run real chi-squared steganalysis to see which ones a detector catches.
        </p>
      </div>
      <aside class="cl-hero-why" aria-label="Why it matters">
        <span class="cl-hero-why-label">WHY IT MATTERS</span>
        <p class="cl-hero-why-text">
          Cryptography hides a message's meaning; steganography hides its very existence — decisive where being seen to communicate is itself the risk. But hidden bits leave statistical traces, so every scheme races an evolving steganalyzer.
        </p>
      </aside>
    </header>

    <div class="source-bar" role="group" aria-label="Cover image source">
      <span class="source-label">Cover image (feeds every exhibit):</span>
      <label class="file-btn">
        <span>Upload your own…</span>
        <input id="cover-upload" type="file" accept="image/*" hidden />
      </label>
      <button id="cover-sample" type="button" class="ghost">Use sample landscape</button>
      <span id="cover-source-name" class="source-name" aria-live="polite">Sample landscape · 256×256</span>
    </div>

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
          <p>LSB substitution ↔ chi-squared steganalysis (Westfeld &amp; Pfitzmann 1999).</p>
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
      <div class="capacity" role="group" aria-label="Payload capacity usage">
        <div class="capacity-track"><div id="lsb-capacity-fill" class="capacity-fill"></div></div>
        <small id="lsb-capacity-text">Capacity usage updates as you type.</small>
      </div>
      <div class="controls" role="toolbar" aria-label="LSB embedding controls">
        <button id="lsb-embed" type="button">Embed message</button>
        <button id="lsb-extract" type="button">Extract message</button>
        <button id="lsb-download" type="button">Download stego PNG</button>
        <label class="file-btn control-file">
          <span>Extract from PNG…</span>
          <input id="lsb-extract-file" type="file" accept="image/png" hidden />
        </label>
        <button id="lsb-reset" type="button" class="ghost">Reset</button>
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
        Visual similarity is not statistical similarity — watch the PSNR stay high while chi-squared still flags it.
      </div>
    </section>

    <section class="exhibit" id="exhibit-3" aria-labelledby="exhibit-3-heading">
      <h2 id="exhibit-3-heading">Exhibit 3 — Chi-Squared Steganalysis: Detecting LSB</h2>
      <p>
        Westfeld &amp; Pfitzmann (IH 1999) pair-value test over (0,1), (2,3), ..., (254,255). LSB embedding tends to equalize each pair.
        This implementation computes a real chi-squared statistic over 127 degrees of freedom and reports the
        <strong>probability of embedding</strong> = <em>Q</em>(dof/2, χ²/2). Near 1 ⇒ the carrier looks LSB-embedded; near 0 ⇒ it looks like a natural cover.
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
        which is why naive LSB has been considered weak for adversarial use since 1999. Note its blind spot:
        applied to the whole image it only fires reliably near full embedding — partial payloads stay near 0,
        which is exactly why partial and adaptive embedding (and stronger detectors like RS, SPA, and ML) exist.
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
        Educational simplification inspired by WOW (Holub &amp; Fridrich, WIFS 2012): compute a texture map using Sobel gradients,
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

// --- Canvas / drawing helpers (DOM-specific; pure logic lives in src/lib) ---

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

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "currentColor";
}

function drawImageData(ctx: CanvasRenderingContext2D, image: ImageData): void {
  ctx.putImageData(image, 0, 0);
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

function drawHistogram(hist: number[], canvasId: string): void {
  const ctx = getCtx(canvasId);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...hist, 1);
  ctx.fillStyle = cssVar("--accent-2");
  for (let i = 0; i < 256; i += 1) {
    const x = (i / 256) * w;
    const barH = (hist[i] / max) * (h - 8);
    ctx.fillRect(x, h - barH, Math.max(1, w / 256), barH);
  }
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
    const log = (k - 1) * Math.log(x) - x / 2 - k * Math.log(2) - gammlnLocal(k);
    return Math.exp(log);
  };

  let peak = 0;
  for (let x = 0.001; x <= maxX; x += step) {
    peak = Math.max(peak, pdf(x));
  }

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = cssVar("--accent-2");
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
  ctx.strokeStyle = cssVar("--danger");
  ctx.beginPath();
  ctx.moveTo(markerX, 8);
  ctx.lineTo(markerX, h - 8);
  ctx.stroke();
}

// Local copy of the log-gamma used only for plotting the chi-squared PDF curve.
function gammlnLocal(xx: number): number {
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
      ctx.strokeStyle = modified.has(key) ? cssVar("--danger") : cssVar("--border");
      ctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }
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
    const red = clamp255((1 - t) * 230);
    const green = clamp255(t * 220);
    const baseIdx = i * 4;
    out.data[baseIdx] = red;
    out.data[baseIdx + 1] = green;
    out.data[baseIdx + 2] = 70;
    out.data[baseIdx + 3] = 220;
  }

  ctx.putImageData(out, 0, 0);
}

function drawLocations(base: ImageData, changed: Uint32Array, canvasId: string): void {
  const ctx = getCtx(canvasId);
  ctx.putImageData(base, 0, 0);
  ctx.fillStyle = cssVar("--danger");
  for (let i = 0; i < changed.length; i += 1) {
    const p = changed[i];
    const x = p % base.width;
    const y = Math.floor(p / base.width);
    ctx.fillRect(x, y, 1, 1);
  }
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// --- Cover image state, shared by every exhibit ---

let coverImage = createSampleImageData(CANVAS_SIZE, CANVAS_SIZE, SAMPLE_SEED);
let lsbStegoImage = cloneImageData(coverImage);
let dctState: DctState = computeDctBlocks(coverImage);
let dctStegoImage = cloneImageData(coverImage);
let adaptiveGradient = sobelGradient(coverImage);
let adaptiveStego = cloneImageData(coverImage);
let sequentialStego = cloneImageData(coverImage);
let adaptiveChanged: Uint32Array = new Uint32Array(0);
let sequentialChanged: Uint32Array = new Uint32Array(0);

let lsbHasEmbedded = false;
let dctHasEmbedded = false;
let adaptHasEmbedded = false;
let seqHasEmbedded = false;

const lsbCoverCtx = getCtx("lsb-cover");
const lsbStegoCtx = getCtx("lsb-stego");
const dctImageCtx = getCtx("dct-image");

const lsbStats = document.getElementById("lsb-stats") as HTMLDivElement;
const chiResults = document.getElementById("chi-results") as HTMLDivElement;
const chiCurve = document.getElementById("chi-curve") as HTMLDivElement;
const dctStats = document.getElementById("dct-stats") as HTMLDivElement;
const adaptStats = document.getElementById("adapt-stats") as HTMLDivElement;
const coverSourceName = document.getElementById("cover-source-name") as HTMLSpanElement;
const capacityFill = document.getElementById("lsb-capacity-fill") as HTMLDivElement;
const capacityText = document.getElementById("lsb-capacity-text") as HTMLElement;

const lsbMessageEl = document.getElementById("lsb-message") as HTMLTextAreaElement;
const lsbEncryptEl = document.getElementById("lsb-encrypt") as HTMLInputElement;
const lsbPassphraseEl = document.getElementById("lsb-passphrase") as HTMLInputElement;

function redrawAll(): void {
  drawImageData(lsbCoverCtx, coverImage);
  drawImageData(lsbStegoCtx, lsbStegoImage);
  drawZoom(coverImage, "lsb-zoom-cover", 80, 80);
  drawZoom(lsbStegoImage, "lsb-zoom-stego", 80, 80);
  drawHistogram(computeHistogram(coverImage), "lsb-hist-cover");
  drawHistogram(computeHistogram(lsbStegoImage), "lsb-hist-stego");
  drawImageData(dctImageCtx, dctStegoImage);
  drawCostMap(adaptiveGradient, coverImage, "adapt-map-canvas");
  drawLocations(coverImage, new Uint32Array(0), "adapt-locations");
  drawLocations(coverImage, new Uint32Array(0), "seq-locations");
  drawChiPlot("chi-plot", 127, 127);
}

/** Reset every exhibit's derived state to a fresh cover image. */
function setCoverImage(image: ImageData, sourceLabel: string): void {
  coverImage = image;
  lsbStegoImage = cloneImageData(coverImage);
  dctState = computeDctBlocks(coverImage);
  dctStegoImage = cloneImageData(coverImage);
  adaptiveGradient = sobelGradient(coverImage);
  adaptiveStego = cloneImageData(coverImage);
  sequentialStego = cloneImageData(coverImage);
  lsbHasEmbedded = false;
  dctHasEmbedded = false;
  adaptHasEmbedded = false;
  seqHasEmbedded = false;

  coverSourceName.textContent = `${sourceLabel} · ${coverImage.width}×${coverImage.height}`;
  redrawAll();
  getCtx("dct-before").clearRect(0, 0, 240, 240);
  getCtx("dct-after").clearRect(0, 0, 240, 240);
  lsbStats.textContent = "";
  chiResults.textContent = "";
  chiCurve.textContent = "";
  dctStats.textContent = "";
  adaptStats.textContent = "";
  updateCapacityMeter();
}

/** Scale + center-crop an arbitrary image to a square cover of the given size. */
async function fileToCoverImage(file: File, size: number): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get a 2D context for image import.");
  }
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
  bitmap.close();
  return ctx.getImageData(0, 0, size, size);
}

/** Decode a PNG to ImageData at its natural size, preserving exact pixels for extraction. */
async function fileToExactImage(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get a 2D context for image import.");
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

// --- Initial render ---

redrawAll();

// --- Capacity meter ---

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function updateCapacityMeter(): void {
  const message = lsbMessageEl.value;
  const encrypt = lsbEncryptEl.checked;
  const payloadBytes = encrypt ? AES_OVERHEAD_BYTES + utf8Length(message) : utf8Length(message);
  const neededBits = lsbPacketBytes(payloadBytes) * 8;
  const capacity = lsbCapacityBits(coverImage);
  const ratio = capacity > 0 ? neededBits / capacity : 1;
  const pct = Math.min(100, ratio * 100);
  capacityFill.style.width = `${pct}%`;
  capacityFill.classList.toggle("over", neededBits > capacity);
  const overBudget = neededBits > capacity;
  capacityText.innerHTML = overBudget
    ? `<span class="status-warn">Payload needs ${neededBits.toLocaleString()} bits but only ${capacity.toLocaleString()} are available.</span>`
    : `Payload ${neededBits.toLocaleString()} bits of ${capacity.toLocaleString()} available (${pct.toFixed(2)}%)${
        encrypt ? " · includes AES salt/IV/tag overhead" : ""
      }.`;
}

lsbMessageEl.addEventListener("input", updateCapacityMeter);
lsbEncryptEl.addEventListener("change", updateCapacityMeter);
updateCapacityMeter();

// --- Async busy-state helper ---

async function withBusy<T>(button: HTMLButtonElement, busyLabel: string, fn: () => Promise<T> | T): Promise<T> {
  const original = button.textContent;
  button.disabled = true;
  button.dataset.busy = "true";
  button.textContent = busyLabel;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    delete button.dataset.busy;
    button.textContent = original;
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Render a recovered message with a copy-to-clipboard affordance. */
function renderRecovered(target: HTMLElement, message: string, suffix: string): void {
  target.innerHTML = `Recovered: <strong>${escapeHtml(message)}</strong> <button type="button" class="copy-btn" data-copy="${escapeHtml(
    message
  )}">Copy</button><br/>${suffix}`;
  const btn = target.querySelector(".copy-btn") as HTMLButtonElement | null;
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(message);
        btn.textContent = "Copied ✓";
        window.setTimeout(() => {
          btn.textContent = "Copy";
        }, 1500);
      } catch {
        btn.textContent = "Copy failed";
      }
    });
  }
}

type ParsedLsb = { mode: number; payload: Uint8Array };

/** Safely read an LSB packet out of an image, guarding against non-stego carriers. */
function readLsbPacket(image: ImageData): ParsedLsb | { error: string } {
  const capacity = lsbCapacityBits(image);
  const headerBits = extractBitsSpatial(image, 32);
  const packetLen = bytesToU32(bitsToBytes(headerBits), 0);
  if (packetLen <= 0 || (packetLen + 4) * 8 > capacity) {
    return { error: "No valid hidden packet found in this image." };
  }
  const totalBits = (packetLen + 4) * 8;
  const bits = extractBitsSpatial(image, totalBits);
  const packet = bitsToBytes(bits);
  const body = parsePacketBytes(packet);
  const parsed = parseLsbBody(body);
  if (parsed.payload.length + 5 > body.length) {
    return { error: "Hidden packet is malformed or truncated." };
  }
  return parsed;
}

async function decodeLsbPacket(parsed: ParsedLsb): Promise<{ packet: LsbPacket } | { error: string }> {
  if (parsed.mode === 1) {
    const passphrase = lsbPassphraseEl.value;
    if (!passphrase) {
      return { error: "Encrypted payload found: enter the passphrase to decrypt." };
    }
    try {
      const message = await decryptAesGcm(parsed.payload, passphrase);
      return { packet: { mode: "encrypted", message, passphraseUsed: true } };
    } catch {
      return { error: "Decryption failed. Check the passphrase." };
    }
  }
  return { packet: { mode: "plain", message: new TextDecoder().decode(parsed.payload), passphraseUsed: false } };
}

// --- Cover source controls ---

(document.getElementById("cover-sample") as HTMLButtonElement).addEventListener("click", () => {
  setCoverImage(createSampleImageData(CANVAS_SIZE, CANVAS_SIZE, SAMPLE_SEED), "Sample landscape");
});

(document.getElementById("cover-upload") as HTMLInputElement).addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  try {
    const image = await fileToCoverImage(file, CANVAS_SIZE);
    setCoverImage(image, `Uploaded: ${file.name}`);
  } catch {
    coverSourceName.innerHTML = `<span class="status-warn">Could not load that image. Try a PNG or JPEG.</span>`;
  } finally {
    input.value = "";
  }
});

// --- LSB exhibit ---

const lsbEmbedBtn = document.getElementById("lsb-embed") as HTMLButtonElement;
lsbEmbedBtn.addEventListener("click", async () => {
  const message = lsbMessageEl.value;
  const encrypt = lsbEncryptEl.checked;
  const passphrase = lsbPassphraseEl.value;

  if (!message) {
    lsbStats.innerHTML = `<span class="status-warn">Provide a message first.</span>`;
    return;
  }

  if (encrypt && !passphrase) {
    lsbStats.innerHTML = `<span class="status-warn">Encryption selected: passphrase is required.</span>`;
    return;
  }

  await withBusy(lsbEmbedBtn, "Embedding…", async () => {
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

    const metrics = distortion(coverImage, lsbStegoImage);
    const psnrText = metrics.psnr === Infinity ? "∞ (identical)" : `${metrics.psnr.toFixed(2)} dB`;
    const info = result.firstChange
      ? `Pixel (${result.firstChange.x}, ${result.firstChange.y}) channel before ${result.firstChange.valueBefore} (LSB ${result.firstChange.valueBefore & 1}), after ${result.firstChange.valueAfter} (LSB ${result.firstChange.valueAfter & 1}), payload bit ${result.firstChange.bit}.`
      : "No first-change sample available (all initial bits matched existing LSBs).";

    lsbStats.innerHTML = `
      <div>Payload: ${plainBytes.length} bytes plaintext, ${payload.length} bytes stored. Capacity: ${(capacity / 8).toFixed(0)} bytes.</div>
      <div>Mode: ${encrypt ? "AES-256-GCM then steganography" : "Plaintext steganography"}.</div>
      <div>Fidelity: PSNR ${psnrText}, max channel change ${metrics.maxDelta}, ${metrics.changedChannels.toLocaleString()} channels modified.</div>
      <div>${info}</div>
    `;
  });
});

const lsbExtractBtn = document.getElementById("lsb-extract") as HTMLButtonElement;
lsbExtractBtn.addEventListener("click", async () => {
  if (!lsbHasEmbedded) {
    lsbStats.innerHTML = `<span class="status-warn">No message embedded yet. Embed a message first.</span>`;
    return;
  }
  await withBusy(lsbExtractBtn, "Extracting…", async () => {
    const parsed = readLsbPacket(lsbStegoImage);
    if ("error" in parsed) {
      lsbStats.innerHTML = `<span class="status-warn">${parsed.error}</span>`;
      return;
    }
    const decoded = await decodeLsbPacket(parsed);
    if ("error" in decoded) {
      lsbStats.innerHTML = `<span class="status-warn">${decoded.error}</span>`;
      return;
    }
    const { packet } = decoded;
    renderRecovered(lsbStats, packet.message, `Mode: ${packet.mode}${packet.passphraseUsed ? " (passphrase used)" : ""}`);
  });
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

const lsbExtractFileEl = document.getElementById("lsb-extract-file") as HTMLInputElement;
lsbExtractFileEl.addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  try {
    const image = await fileToExactImage(file);
    const parsed = readLsbPacket(image);
    if ("error" in parsed) {
      lsbStats.innerHTML = `<span class="status-warn">${parsed.error} (Re-encoding to JPEG destroys LSBs — use the exact PNG this demo produced.)</span>`;
      return;
    }
    const decoded = await decodeLsbPacket(parsed);
    if ("error" in decoded) {
      lsbStats.innerHTML = `<span class="status-warn">${decoded.error}</span>`;
      return;
    }
    renderRecovered(
      lsbStats,
      decoded.packet.message,
      `Extracted from uploaded PNG (${image.width}×${image.height}) · mode: ${decoded.packet.mode}`
    );
  } catch {
    lsbStats.innerHTML = `<span class="status-warn">Could not read that PNG.</span>`;
  } finally {
    input.value = "";
  }
});

(document.getElementById("lsb-reset") as HTMLButtonElement).addEventListener("click", () => {
  lsbStegoImage = cloneImageData(coverImage);
  lsbHasEmbedded = false;
  drawImageData(lsbStegoCtx, lsbStegoImage);
  drawZoom(lsbStegoImage, "lsb-zoom-stego", 80, 80);
  drawHistogram(computeHistogram(lsbStegoImage), "lsb-hist-stego");
  lsbStats.innerHTML = "Stego image reset to the current cover.";
});

// --- Chi-squared exhibit ---

const DETECT_THRESHOLD = 0.5;

function renderChiResult(label: string, res: { chi2: number; pEmbed: number; dof: number }): string {
  const detected = res.pEmbed > DETECT_THRESHOLD;
  return `
    ${label}: χ²=${res.chi2.toFixed(2)}, probability of embedding=${(res.pEmbed * 100).toFixed(2)}%
    <span class="${detected ? "status-warn" : "status-ok"}">${detected ? "✗ LSB embedding detected" : "✓ No LSB embedding detected"}</span>
  `;
}

(document.getElementById("chi-test-cover") as HTMLButtonElement).addEventListener("click", () => {
  const res = chiSquaredSteganalysis(coverImage);
  drawChiPlot("chi-plot", res.chi2, res.dof);
  chiResults.innerHTML = renderChiResult("Cover test", res);
});

(document.getElementById("chi-test-stego") as HTMLButtonElement).addEventListener("click", () => {
  if (!lsbHasEmbedded) {
    chiResults.innerHTML = `<span class="status-warn">No LSB embedding done yet. Embed a message in Exhibit 2 first.</span>`;
    return;
  }
  const res = chiSquaredSteganalysis(lsbStegoImage);
  drawChiPlot("chi-plot", res.chi2, res.dof);
  chiResults.innerHTML = renderChiResult("Stego test", res);
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
    const flag = res.pEmbed > DETECT_THRESHOLD ? "✗ detected" : "✓ evades";
    return `<tr><td>${Math.round(r * 100)}%</td><td>${bitCount.toLocaleString()}</td><td>${res.chi2.toFixed(2)}</td><td>${(res.pEmbed * 100).toFixed(2)}%</td><td>${flag}</td></tr>`;
  });
  chiCurve.innerHTML = `<div class="table-wrap"><table><thead><tr><th scope="col">Payload rate</th><th scope="col">Bits</th><th scope="col">χ²</th><th scope="col">P(embedding)</th><th scope="col">Verdict</th></tr></thead><tbody>${rows.join("")}</tbody></table></div><small>Sequential whole-image embedding: the global test only flags the carrier as the payload nears full capacity.</small>`;
});

// --- DCT exhibit ---

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
  renderRecovered(dctStats, message, "Recovered from the DCT coefficient stream.");
});

// --- Adaptive exhibit ---

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
  adaptiveChanged = changed;
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
  sequentialChanged = changed;
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
  const adaptTexture = meanGradientAt(adaptiveGradient, adaptiveChanged);
  const seqTexture = meanGradientAt(adaptiveGradient, sequentialChanged);
  const adaptSmooth = smoothFractionAt(adaptiveGradient, adaptiveChanged);
  const seqSmooth = smoothFractionAt(adaptiveGradient, sequentialChanged);
  adaptStats.innerHTML = `
    <div>Same ${adaptiveChanged.length.toLocaleString()}-bit payload, different placement:</div>
    <div>Mean texture at embedding sites — adaptive <strong>${adaptTexture.toFixed(1)}</strong> vs sequential <strong>${seqTexture.toFixed(1)}</strong> (higher = busier, harder to model).</div>
    <div>Bits landing in smooth regions — adaptive <strong>${(adaptSmooth * 100).toFixed(1)}%</strong> vs sequential <strong>${(seqSmooth * 100).toFixed(1)}%</strong> (lower is stealthier).</div>
    <div>Whole-image chi-square sees neither at this payload (P(embedding): sequential ${(seq.pEmbed * 100).toFixed(2)}%, adaptive ${(adaptive.pEmbed * 100).toFixed(2)}%) — the crude global test is blind here. Adaptive's advantage shows up against richer-model / ML detectors, by keeping bits out of smooth regions where any detector looks first.</div>
  `;
});

installThemeToggle();
