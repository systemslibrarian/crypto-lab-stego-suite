import { expect, test, type Page } from '@playwright/test';

function luminance(rgb: number[]): number {
  const linear = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a: number[], b: number[]): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function fieldColors(page: Page): Promise<{ border: number[]; background: number[] }> {
  return page.locator('#lsb-message').evaluate((element) => {
    const rgba = (value: string): number[] => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const over = (top: number[], bottom: number[]): number[] => {
      const alpha = top[3] / 255;
      return [0, 1, 2].map((index) => top[index] * alpha + bottom[index] * (1 - alpha));
    };

    const border = rgba(getComputedStyle(element).borderTopColor).slice(0, 3);
    let background = [0, 0, 0];
    let node: Element | null = element;
    const layers: number[][] = [];
    while (node) {
      layers.push(rgba(getComputedStyle(node).backgroundColor));
      node = node.parentElement;
    }
    for (const layer of layers.reverse()) background = over(layer, background);
    return { border, background };
  });
}

test('load-bearing message boundary clears 3:1', async ({ page }) => {
  await page.goto('.');
  const colors = await fieldColors(page);
  expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(3);
});
