/**
 * The beginner front-section: hide a message in a picture, see that it is
 * invisible, get it back, then watch a detector find it anyway.
 *
 * Every step calls the machinery the exhibits below already use -- the same
 * `embedBitsSpatial` / `extractBitsSpatial` and the same
 * `chiSquaredSteganalysis` at the same `DETECT_THRESHOLD`. Nothing here is a
 * second implementation, so this section cannot drift into disagreeing with
 * Exhibit 2 or Exhibit 3 about what the lab does.
 *
 * What it hides from the reader is the NOTATION, not the work: no bit planes,
 * no chi-squared statistic, no p-value and no bits-per-pixel in the section
 * itself. The statistic and the threshold are one disclosure away, pointing
 * into Exhibit 3 where they are explained.
 *
 * STEP 4 SAYS "CLEAN", AND THAT IS THE POINT. The first draft of this section
 * followed its brief and asserted the detector would flag a hidden sentence.
 * Measured against this lab's own detector and its own sample image, it does
 * not: one sentence is about 0.14% of the picture's capacity, and the global
 * chi-squared test does not move until roughly 98% of it is used -- about
 * 23.5 KB of hidden text. The lab's own detectability curve already says so in
 * its own words, that "the global test only flags the carrier as the payload
 * nears full capacity". Padding the picture to make the detector fire would
 * have passed every test and taught a beginner something false. So the section
 * shows what is true instead: clean on both, then a second button that fills
 * the picture until the detector does fire.
 */

import { decodeTextPacket, encodeTextPacket } from "./lib/bits";
import { chiSquaredSteganalysis, DETECT_THRESHOLD } from "./lib/chi";
import { createSampleImageData } from "./lib/image";
import { embedBitsSpatial, extractBitsSpatial, lsbCapacityBits } from "./lib/stego";

const SIZE = 256;
const SEED = 37;
const SECRET = "Meet me at the library at four.";

type State = {
  cover: ImageData | null;
  stego: ImageData | null;
  filled: ImageData | null;
  bitCount: number;
};

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`first-look: #${id} is missing from the page`);
  }
  return node as T;
};

/** Pixels where any colour channel differs. A plain count, not a rate. */
export function changedPixels(cover: ImageData, stego: ImageData): number {
  let changed = 0;
  for (let p = 0; p < cover.data.length; p += 4) {
    if (
      cover.data[p] !== stego.data[p] ||
      cover.data[p + 1] !== stego.data[p + 1] ||
      cover.data[p + 2] !== stego.data[p + 2]
    ) {
      changed += 1;
    }
  }
  return changed;
}

/**
 * Read a message back out of a picture. BOTH reads in step 3 go through here --
 * the carrier and the untouched original -- because that is what makes the
 * control worth anything: if this ever stops consulting the image, the original
 * starts returning the message too, and the control says so.
 */
export function readFromPicture(image: ImageData, bitCount: number): string {
  return decodeTextPacket(extractBitsSpatial(image, bitCount));
}

/** The detector's answer in the two words this section uses for it. */
export function detectorVerdict(image: ImageData): { flagged: boolean; pEmbed: number; chi2: number } {
  const res = chiSquaredSteganalysis(image);
  return { flagged: res.pEmbed > DETECT_THRESHOLD, pEmbed: res.pEmbed, chi2: res.chi2 };
}

function paint(canvasId: string, image: ImageData): void {
  const canvas = el<HTMLCanvasElement>(canvasId);
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error(`first-look: 2D context unavailable for #${canvasId}`);
  }
  ctx.putImageData(image, 0, 0);
}

function setVerdict(node: HTMLElement, outcome: string, tone: "neutral" | "good" | "finding", text: string): void {
  node.setAttribute("data-outcome", outcome);
  node.className = `fl-verdict fl-${tone}`;
  node.textContent = text;
}

export function mountFirstLook(): void {
  const state: State = { cover: null, stego: null, filled: null, bitCount: 0 };

  const hideBtn = el<HTMLButtonElement>("fl-hide");
  const extractBtn = el<HTMLButtonElement>("fl-extract");
  const detectBtn = el<HTMLButtonElement>("fl-detect");
  const hideStatus = el("fl-hide-status");
  const lookStatus = el("fl-look-status");
  const recovered = el("fl-recovered");
  const control = el("fl-control");
  const detectCover = el("fl-detect-cover");
  const detectStego = el("fl-detect-stego");
  const working = el("fl-working");
  const fillBtn = el<HTMLButtonElement>("fl-fill");
  const detectFilled = el("fl-detect-filled");
  const workingFilled = el("fl-working-filled");

  hideBtn.addEventListener("click", () => {
    const cover = createSampleImageData(SIZE, SIZE, SEED);
    const bits = encodeTextPacket(SECRET);
    const { stego } = embedBitsSpatial(cover, bits);
    state.cover = cover;
    state.stego = stego;
    state.bitCount = bits.length;

    paint("fl-cover-canvas", cover);
    paint("fl-stego-canvas", stego);

    hideStatus.textContent = `Hidden. The message "${SECRET}" is now inside the picture on the right.`;

    /* The count is the point of step 2: it is a real number of pixels, and it
       is small enough that the eye has no chance -- which is why the section
       says so in a count rather than asking you to trust the picture. */
    const changed = changedPixels(cover, stego);
    setVerdict(
      lookStatus,
      changed > 0 ? "CHANGED" : "UNCHANGED",
      "neutral",
      changed > 0
        ? `${changed.toLocaleString()} of the ${(SIZE * SIZE).toLocaleString()} pixels changed, each by the smallest step a colour can take. Nothing you can see.`
        : "No pixel changed at all — nothing was hidden.",
    );

    extractBtn.disabled = false;
    detectBtn.disabled = false;
    recovered.textContent = "";
    recovered.removeAttribute("data-outcome");
    control.textContent = "";
    control.removeAttribute("data-outcome");
    for (const node of [detectCover, detectStego, detectFilled]) {
      node.textContent = "";
      node.removeAttribute("data-outcome");
    }
    working.textContent = "";
    workingFilled.textContent = "";
    fillBtn.disabled = true;
    state.filled = null;
  });

  extractBtn.addEventListener("click", () => {
    if (!state.stego || !state.cover) {
      return;
    }
    const out = readFromPicture(state.stego, state.bitCount);
    setVerdict(
      recovered,
      out === SECRET ? "MATCH" : "DIFFERENT",
      out === SECRET ? "good" : "finding",
      out === SECRET ? `Recovered from the picture: "${out}"` : "The message did not come back intact.",
    );

    /* The control, and the reason it is here: reading the ORIGINAL with the
       same method must not produce the message. Without it, "we got the
       message back" is equally consistent with the page simply remembering
       what it embedded. */
    const fromCover = readFromPicture(state.cover, state.bitCount);
    setVerdict(
      control,
      fromCover === SECRET ? "LEAKED" : "NOTHING",
      fromCover === SECRET ? "finding" : "neutral",
      fromCover === SECRET
        ? "The same read of the untouched original returned the message, which would mean nothing was read from the picture at all."
        : "The same read of the untouched original returns nothing readable — so the message really did come out of the picture.",
    );
  });

  detectBtn.addEventListener("click", () => {
    if (!state.stego || !state.cover) {
      return;
    }
    const cover = detectorVerdict(state.cover);
    const stego = detectorVerdict(state.stego);

    setVerdict(
      detectCover,
      cover.flagged ? "FLAGGED" : "CLEAN",
      "neutral",
      cover.flagged ? "The original: a hidden message found." : "The original: nothing found. There is nothing in it.",
    );
    setVerdict(
      detectStego,
      stego.flagged ? "FLAGGED" : "CLEAN",
      stego.flagged ? "finding" : "good",
      stego.flagged
        ? "The picture with the sentence in it: a hidden message found."
        : "The picture with the sentence in it: nothing found either \u2014 and there IS a message in it. You just read it.",
    );

    fillBtn.disabled = false;
    working.textContent =
      `Original: probability of embedding ${(cover.pEmbed * 100).toFixed(2)}%. ` +
      `With the sentence: ${(stego.pEmbed * 100).toFixed(2)}%. ` +
      `Reported as found above ${(DETECT_THRESHOLD * 100).toFixed(0)}%. Exhibit 3 explains the number.`;
  });

  fillBtn.addEventListener("click", () => {
    if (!state.cover) {
      return;
    }
    /* Fill every slot the picture has. Same embed as step 1, same detector --
       the only change is how much is hidden.

       The filler is RANDOM bytes, which is both what the lab's own payload
       curve uses and what a real hidden payload looks like: Exhibit 1's advice
       is to encrypt first and then embed, and ciphertext is random-looking.
       It also has to be. Filling with the sentence repeated to capacity does
       NOT trip the detector -- measured -- because repeated ASCII has a lopsided
       bit pattern, and this test keys on the 50/50 evening-out that a random
       payload produces. A filler that looked more "realistic" as text would
       have quietly shown the wrong answer. */
    const capacity = lsbCapacityBits(state.cover);
    const filler = crypto.getRandomValues(new Uint8Array(Math.ceil(capacity / 8)));
    const bits: number[] = [];
    for (let i = 0; i < capacity; i += 1) {
      bits.push((filler[i >> 3] >> (7 - (i & 7))) & 1);
    }
    const { stego: filled } = embedBitsSpatial(state.cover, bits);
    state.filled = filled;

    paint("fl-filled-canvas", filled);
    const full = detectorVerdict(filled);
    setVerdict(
      detectFilled,
      full.flagged ? "FLAGGED" : "CLEAN",
      full.flagged ? "finding" : "neutral",
      full.flagged
        ? `Now it is found. Same picture, same method, same detector \u2014 the only change is how much is hidden: about ${Math.round(capacity / 8 / 1024)} KB instead of one sentence. Look at it, too: at this much the change has stopped being invisible, which is the other half of why nobody hides this much in one picture.`
        : "Still nothing found, even with the picture full.",
    );
    workingFilled.textContent =
      `Filled: probability of embedding ${(full.pEmbed * 100).toFixed(2)}%, against ${(DETECT_THRESHOLD * 100).toFixed(0)}% to be reported. ` +
      `Exhibit 3's payload curve walks the rates in between.`;
  });
}
