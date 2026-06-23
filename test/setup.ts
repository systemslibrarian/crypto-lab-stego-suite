// Minimal ImageData polyfill so the lib modules can run under Node's test runner
// without pulling in a full DOM. Matches the two constructor signatures the code uses:
//   new ImageData(width, height)
//   new ImageData(Uint8ClampedArray, width, height)

class ImageDataPolyfill {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly colorSpace = "srgb";

  constructor(a: Uint8ClampedArray | number, b: number, c?: number) {
    if (a instanceof Uint8ClampedArray) {
      this.data = a;
      this.width = b;
      this.height = c ?? 0;
    } else {
      this.width = a;
      this.height = b;
      this.data = new Uint8ClampedArray(a * b * 4);
    }
  }
}

if (typeof (globalThis as { ImageData?: unknown }).ImageData === "undefined") {
  (globalThis as { ImageData?: unknown }).ImageData = ImageDataPolyfill as unknown as typeof ImageData;
}
