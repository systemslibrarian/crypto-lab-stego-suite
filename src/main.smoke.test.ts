// @vitest-environment jsdom
//
// Integration smoke test: load the real main.ts wiring against jsdom with a stubbed
// canvas context, then drive every interactive control and assert no handler throws
// and each status region updates. Guards against missing element IDs and broken wiring.

import { beforeAll, describe, expect, it } from "vitest";

function fakeCtx(): CanvasRenderingContext2D {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "canvas") {
        return { width: 256, height: 256 };
      }
      if (prop === "getImageData") {
        return (_x: number, _y: number, w: number, h: number) => new ImageData(w, h);
      }
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop() {} });
      }
      return () => undefined;
    }
  };
  return new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function click(id: string): void {
  const el = document.getElementById(id);
  expect(el, `#${id} should exist`).not.toBeNull();
  (el as HTMLElement).click();
}

beforeAll(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  HTMLCanvasElement.prototype.getContext = (() => fakeCtx()) as unknown as HTMLCanvasElement["getContext"];
  if (typeof globalThis.localStorage === "undefined") {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0
    };
  }
  await import("./main");
});

describe("DOM smoke test", () => {
  it("renders all six exhibits", () => {
    for (let i = 1; i <= 6; i += 1) {
      expect(document.getElementById(`exhibit-${i}`)).not.toBeNull();
    }
  });

  it("runs the full LSB embed → extract round-trip without throwing", async () => {
    (document.getElementById("lsb-message") as HTMLTextAreaElement).value = "smoke test payload";
    click("lsb-embed");
    await flush();
    const stats = document.getElementById("lsb-stats") as HTMLDivElement;
    expect(stats.textContent).toContain("PSNR");

    click("lsb-extract");
    await flush();
    expect(stats.textContent).toContain("smoke test payload");
  });

  it("drives chi-squared controls", async () => {
    click("chi-test-cover");
    await flush();
    expect((document.getElementById("chi-results") as HTMLDivElement).textContent).toContain("probability of embedding");
    click("chi-test-stego");
    await flush();
    click("chi-run-curve");
    await flush();
    expect((document.getElementById("chi-curve") as HTMLDivElement).querySelector("table")).not.toBeNull();
  });

  it("drives the DCT workflow", async () => {
    click("dct-transform");
    click("dct-embed");
    click("dct-inverse");
    click("dct-extract");
    await flush();
    expect((document.getElementById("dct-stats") as HTMLDivElement).textContent).toContain("Recovered");
  });

  it("drives adaptive embedding and comparison", async () => {
    click("adapt-map");
    click("adapt-embed");
    click("adapt-seq");
    click("adapt-compare");
    await flush();
    const stats = (document.getElementById("adapt-stats") as HTMLDivElement).textContent ?? "";
    expect(stats).toContain("Mean texture");
  });

  it("resets and toggles theme", () => {
    click("lsb-reset");
    expect((document.getElementById("lsb-stats") as HTMLDivElement).textContent).toContain("reset");
    click("theme-toggle");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
