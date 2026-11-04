import { expect, test, type Page } from '@playwright/test';

// J2 Heat (docs/specs/forge-prototype.md). Pins one temperature per band anchor and checks, in a greyscale
// reading of the metal's bounding box, that mean brightness strictly rises.
type Box = { x: number; y: number; width: number; height: number };
type Api = {
  state(): { location: string; temp: number; bellows: boolean } | null;
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
/** Between the cherry and orange anchors: a screen that draws one colour per band would show cherry here. */
const BETWEEN = 900;

/** Wait for two drawn frames, so the canvas shows the state just set. */
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

async function startKnife(page: Page) {
  await page.goto('/?debug');
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap(); // the default mix (S5)
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
  const measure = async (c: number) => {
    await page.evaluate((t) => { const a = (window as unknown as { __artifice: Api }).__artifice; a.pinTemp(t); a.advance(32); }, c);
    await frames(page);
    expect((await api(page, (a) => a.state()))!.temp).toBe(c);
    const box = await api(page, (a) => a.metalBox());
    const shot = await page.screenshot({ clip: box });
    await testInfo.attach(`metal-${c}`, { body: shot, contentType: 'image/png' });
    return meanGrey(page, shot);
  };
  for (const c of ANCHORS) means.push(await measure(c));
  for (let i = 1; i < means.length; i++) expect(means[i], `brightness at ${ANCHORS[i]} °C vs ${ANCHORS[i - 1]} °C: ${means.join(', ')}`).toBeGreaterThan(means[i - 1]!);
  // Continuous, not stepped per band: between two anchors the metal is between them in brightness.
  const mid = await measure(BETWEEN);
  expect(mid, `brightness at ${BETWEEN} °C: ${mid}, anchors ${means.join(', ')}`).toBeGreaterThan(means[2]!);
  expect(mid).toBeLessThan(means[3]!);
});

test('"Burning!" shows only at white heat', async ({ page }) => {
  await startKnife(page);
  await api(page, (a) => { a.pause(); a.pinTemp(1125); a.advance(32); });
  await expect(page.getByText('Burning!')).toBeHidden();
  await api(page, (a) => { a.pinTemp(1275); a.advance(32); });
  await expect(page.getByText('Burning!')).toBeVisible();
});

test('the controls move the bar: drag, the buttons, and the bellows only in the fire', async ({ page }) => {
  await startKnife(page);
  const loc = () => api(page, (a) => a.state()!.location);
  const bellows = page.getByRole('button', { name: 'Hold: bellows' });

  // Drag the bar from the fire onto the anvil.
  const box = await api(page, (a) => a.metalBox());
  // The anvil zone's middle is (227, 457) in the wide shot, 127 and 73 game px from the bar's rest in the fire
  // (src/game/wideLayout.ts); convert game px to CSS px with the canvas's own scale.
  const anvil = await page.evaluate(({ bx, by }) => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const k = c.getBoundingClientRect().width / c.width;
    return { x: bx + 127 * k, y: by + 73 * k };
  }, { bx: box.x + box.width / 2, by: box.y + box.height / 2 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(anvil.x, anvil.y, { steps: 8 });
  await expect.poll(loc).toBe('held');
  await expect(page.getByTestId('intro')).toContainText('Let go over the fire, the anvil or the tub');
  await expect(bellows).toBeDisabled(); // the bellows work only in the fire
  await page.mouse.up();
  await expect.poll(loc).toBe('anvil');
  // On the anvil the close-up view takes over (S3); its button takes the bar back to the fire.
  await page.getByRole('button', { name: 'Back to the fire' }).click();
  await expect.poll(loc).toBe('fire');

  // A drop in empty space sends it back where it came from.
  const b2 = await api(page, (a) => a.metalBox());
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(b2.x + 150, b2.y - 250, { steps: 5 });
  await expect.poll(loc).toBe('held');
  await page.mouse.up();
  await expect.poll(loc).toBe('fire');

  // The button moves it to the anvil and back again; holding the bellows heats it until released.
  await page.getByRole('button', { name: 'To the anvil' }).click();
  await expect.poll(loc).toBe('anvil');
  await page.getByRole('button', { name: 'Back to the fire' }).click();
  await expect.poll(loc).toBe('fire');
  await expect(bellows).toBeEnabled();
  await expect(page.getByTestId('hint')).toHaveText('Watch the colour, glow and sparks. Let go to ease off.');
  const t0 = await api(page, (a) => a.state()!.temp);
  await bellows.hover();
  await page.mouse.down();
  await expect.poll(() => api(page, (a) => a.state()!.bellows)).toBe(true);
  await page.waitForFunction((t) => (window as unknown as { __artifice: Api & { state(): { temp: number } } }).__artifice.state()!.temp > t + 100, t0);
  await page.mouse.up();
  await expect.poll(() => api(page, (a) => a.state()!.bellows)).toBe(false);
});
