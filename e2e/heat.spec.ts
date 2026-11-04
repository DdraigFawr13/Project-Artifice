import { expect, test, type Page } from '@playwright/test';

// J2 Heat (docs/specs/forge-prototype.md). Pins one temperature per band anchor and checks, in a greyscale
// reading of the metal's bounding box, that mean brightness strictly rises.
type Box = { x: number; y: number; width: number; height: number };
type Api = {
  state(): { location: string; temp: number } | null;
  pause(): void;
  advance(ms: number): void;
  send(input: unknown): void;
  pinTemp(c: number | null): void;
  metalBox(): Box;
};
/** Run `fn` in the page with the debug API. The function is sent as source, so it must not close over test values. */
const api = <T>(page: Page, fn: (a: Api) => T) =>
  page.evaluate((src) => new Function('a', `return (${src})(a)`)((window as unknown as { __artifice: Api }).__artifice), fn.toString()) as Promise<T>;
const ANCHORS = [285, 650, 825, 975, 1125, 1275];

async function startKnife(page: Page) {
  await page.goto('/?debug');
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __artifice: Api }).__artifice.state?.() != null);
}

/** Mean of 0.2126 R + 0.7152 G + 0.0722 B over a PNG, decoded in the page (no image library needed). */
async function meanGrey(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
    return sum / (d.length / 4);
  }, png.toString('base64'));
}

test('the bellows heat the bar, the anvil cools it', async ({ page }) => {
  await startKnife(page);
  await api(page, (a) => a.pause());
  const t0 = (await api(page, (a) => a.state()))!.temp;
  await api(page, (a) => { a.send({ bellows: true }); a.advance(4000); });
  const hot = (await api(page, (a) => a.state()))!;
  expect(hot.location).toBe('fire');
  expect(hot.temp).toBeGreaterThan(t0 + 900);
  await api(page, (a) => { a.send({ bellows: false }); a.advance(16); a.send({ grab: true }); a.advance(16); a.send({ drop: 'anvil' }); a.advance(3000); });
  const cooled = (await api(page, (a) => a.state()))!;
  expect(cooled.location).toBe('anvil');
  expect(cooled.temp).toBeLessThan(hot.temp - 100);
});

test('the metal gets brighter at every band anchor, in greyscale', async ({ page }, testInfo) => {
  await startKnife(page);
  await api(page, (a) => { a.pause(); a.send({ grab: true }); a.advance(16); a.send({ drop: 'anvil' }); a.advance(16); });
  const means: number[] = [];
  for (const c of ANCHORS) {
    await page.evaluate((t) => { const a = (window as unknown as { __artifice: Api }).__artifice; a.pinTemp(t); a.advance(32); }, c);
    await page.waitForTimeout(100); // two rendered frames at 60 Hz
    expect((await api(page, (a) => a.state()))!.temp).toBe(c);
    const box = await api(page, (a) => a.metalBox());
    const shot = await page.screenshot({ clip: box });
    means.push(await meanGrey(page, shot));
    await testInfo.attach(`metal-${c}`, { body: shot, contentType: 'image/png' });
  }
  for (let i = 1; i < means.length; i++) expect(means[i], `brightness at ${ANCHORS[i]} °C vs ${ANCHORS[i - 1]} °C: ${means.join(', ')}`).toBeGreaterThan(means[i - 1]!);
});

test('"Burning!" shows only at white heat', async ({ page }) => {
  await startKnife(page);
  await api(page, (a) => { a.pause(); a.pinTemp(1125); a.advance(32); });
  await expect(page.getByText('Burning!')).toBeHidden();
  await api(page, (a) => { a.pinTemp(1275); a.advance(32); });
  await expect(page.getByText('Burning!')).toBeVisible();
});
