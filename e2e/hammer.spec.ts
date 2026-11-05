import { expect, test, type Page } from '@playwright/test';
import { holdForIdeal } from './forge';

// J3 Hammer (docs/specs/forge-prototype.md; S3 "Settled at S3 start"). Reads a target from the debug API, touches
// 40 game px below it and lifts; that target takes a hit and the strike count rises. Each target takes two hits, in rounds.
type Pt = { x: number; y: number; hits: number };
type Api = {
  setSeed(n: number): void;
  state(): { location: string; temp: number; ruin: string | null; strikes: { kind: string; lines: { cause: string; points: number }[] }[]; targets: Pt[] } | null;
  targets(): Pt[];
  pause(): void;
  advance(ms: number): void;
  send(input: unknown): void;
  pinTemp(c: number | null): void;
};
const api = <T>(page: Page, fn: (a: Api) => T) =>
  page.evaluate((src) => new Function('a', `return (${src})(a)`)((window as unknown as { __artifice: Api }).__artifice), fn.toString()) as Promise<T>;
const frames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
/** CSS px per game px, from the canvas itself. */
const cssPerGame = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    return c.getBoundingClientRect().width / c.width;
  });

/** Start a knife with a fixed seed, pause real time, hold the heat and put the bar on the anvil. */
async function knifeOnAnvil(page: Page, temp: number) {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: Api }).__artifice != null);
  await api(page, (a) => a.setSeed(42));
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap(); // the default mix (S5)
  await page.waitForFunction(() => (window as unknown as { __artifice: Api }).__artifice.state?.() != null);
  await page.evaluate((t) => {
    const a = (window as unknown as { __artifice: Api }).__artifice;
    a.pause();
    a.pinTemp(t);
    a.send({ grab: true });
    a.advance(16);
    a.send({ drop: 'anvil' });
    a.advance(32);
  }, temp);
  await expect(page.getByRole('button', { name: 'Back to the fire' })).toBeVisible();
  await frames(page);
}

/** Touch `below` game px under a point, lift, and let two steps run. */
async function strikeAt(page: Page, p: { x: number; y: number }, below = 40) {
  const k = await cssPerGame(page);
  await page.mouse.move(p.x, p.y + below * k);
  await page.mouse.down();
  await holdForIdeal(page); // a plain tap is a light strike
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  await frames(page);
}

test('a lift 40 game px below a target strikes it', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
  await expect(page.locator('.top .steps .on')).toHaveText('Hammer');
  // The force hint takes the hammer hint's place for the first 3 anvils (S2; e2e/depth.spec.ts checks the hammer hint after).
  await expect(page.getByTestId('force-hint')).toHaveText('Hold longer to strike harder. Hot metal wants a light touch.');
  await expect(page.getByTestId('hammer-hint')).toHaveText('Strike the marked spots. Your strike lands at the ring above your thumb when you lift it.');
  const targets = await api(page, (a) => a.targets());
  expect(targets).toHaveLength(9);
  expect((await api(page, (a) => a.state()))!.targets).toHaveLength(9);
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 0 of 9 · −0');

  await strikeAt(page, targets[4]!);
  const s = (await api(page, (a) => a.state()))!;
  expect(s.strikes).toHaveLength(1);
  expect(s.strikes[0]!.kind).toBe('hit');
  // Exactly 40 game px above the touch: a centre hit costs nothing.
  expect(s.strikes[0]!.lines).toEqual([]);
  expect(s.targets[4]!.hits).toBe(1);
  expect((await api(page, (a) => a.targets()))[4]!.hits).toBe(1);
  expect(s.targets.filter((t) => t.hits > 0)).toHaveLength(1);
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 1 of 9 · −0');
  await expect(page.getByTestId('points')).toHaveText('Perfect'); // a centre hit in the band is Perfect now (S1)

  // About 6 game px off-centre: the strike costs points, and the screen shows what the engine scored for it.
  // (Touch positions are rounded by the browser, so the exact distance comes from the engine, not from here.)
  const k = await cssPerGame(page);
  await strikeAt(page, { x: targets[6]!.x + 6 * k, y: targets[6]!.y });
  const off = (await api(page, (a) => a.state()))!.strikes[1]!;
  expect(off.kind).toBe('hit');
  const pts = Math.round(off.lines.reduce((t, l) => t + l.points, 0));
  expect(pts).toBeGreaterThan(0);
  await expect(page.getByTestId('points')).toHaveText(`−${pts}`);
  await expect(page.getByTestId('strikes')).toHaveText(`Round 1 · 2 of 9 · −${pts}`);
  await testInfo.attach('close-view', { body: await page.screenshot(), contentType: 'image/png' });
});

/** Mean RGB of a screenshot clip, decoded in the page (no image library needed). */
async function meanRgb(page: Page, clip: { x: number; y: number; width: number; height: number }): Promise<number[]> {
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) sum[j]! += d[i + j]!;
    return sum.map((v) => v / (d.length / 4));
  }, png.toString('base64'));
}

test('round 2 opens once every target has its first hit', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  const targets = await api(page, (a) => a.targets());
  for (const t of targets) await strikeAt(page, t);
  await expect(page.getByTestId('strikes')).toHaveText(/^Round 2 · 0 of 9 · −\d+( · Clean ×\d+)?$/);
  expect((await api(page, (a) => a.targets())).every((t) => t.hits === 1)).toBe(true);
  // The second hit finishes the stretch: 11–13 game px below a belly target only the finished blade reaches.
  const k = await cssPerGame(page);
  const deep = (t: Pt) => ({ x: t.x - 5 * k, y: t.y + 11 * k, width: 10 * k, height: 2 * k });
  await api(page, (a) => a.advance(800));
  await frames(page);
  const before = await meanRgb(page, deep(targets[5]!));
  await strikeAt(page, targets[5]!);
  expect((await api(page, (a) => a.targets()))[5]!.hits).toBe(2);
  await expect(page.getByTestId('strikes')).toHaveText(/^Round 2 · 1 of 9 · −\d+( · Clean ×\d+)?$/);
  await api(page, (a) => a.advance(800));
  await frames(page);
  const after = await meanRgb(page, deep(targets[5]!));
  expect(Math.max(...after.map((v, i) => Math.abs(v - before[i]!))), 'the second hit finishes the stretch').toBeGreaterThan(20);
});

test('a strike shapes its own stretch of the bar, and only that', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  const targets = await api(page, (a) => a.targets());
  const k = await cssPerGame(page);
  // A strip 7–11 game px below a target: anvil beside the bar, knife once that stretch is shaped (src/game/shapes.ts).
  const strip = (t: Pt) => ({ x: t.x - 5 * k, y: t.y + 7 * k, width: 10 * k, height: 4 * k });
  const diff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
  const before4 = await meanRgb(page, strip(targets[4]!));
  const before8 = await meanRgb(page, strip(targets[8]!));
  await strikeAt(page, targets[4]!);
  await api(page, (a) => a.advance(800)); // let the strike's points and sparks clear
  await frames(page);
  expect(diff(await meanRgb(page, strip(targets[4]!)), before4), 'the struck stretch changes shape').toBeGreaterThan(20);
  expect(diff(await meanRgb(page, strip(targets[8]!)), before8), 'an unstruck stretch stays bar').toBeLessThan(3);
});

test('a lift over the panel cancels the strike', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  const t = (await api(page, (a) => a.targets()))[0]!;
  const k = await cssPerGame(page);
  const back = await page.getByRole('button', { name: 'Back to the fire' }).boundingBox();
  await page.mouse.move(t.x, t.y + 40 * k);
  await page.mouse.down();
  await page.mouse.move(t.x, back!.y - 8, { steps: 4 });
  await page.mouse.move(t.x, back!.y + back!.height + 4, { steps: 4 });
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!.strikes).toHaveLength(0);
});

test('Back to the fire returns to the wide view; Quench is ready', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await expect(page.getByRole('button', { name: 'Quench' })).toBeEnabled();
  await page.getByRole('button', { name: 'Back to the fire' }).click();
  await api(page, (a) => a.advance(64));
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  await expect(page.locator('.top .steps .on')).toHaveText('Heat');
});

test('"Burning!" follows the engine in the close view', async ({ page }) => {
  await knifeOnAnvil(page, 1125);
  await expect(page.getByText('Burning!')).toBeHidden();
  await api(page, (a) => { a.pinTemp(1275); a.advance(32); });
  await expect(page.getByText('Burning!')).toBeVisible();
});

test('three strikes on black metal ruin the craft', async ({ page }) => {
  await knifeOnAnvil(page, 300);
  const targets = await api(page, (a) => a.targets());
  for (const t of targets.slice(0, 3)) await strikeAt(page, t);
  const s = (await api(page, (a) => a.state()))!;
  expect(s).toMatchObject({ location: 'done', ruin: 'cracked' });
  // The ruin screen follows once the last strike's points have shown (S4; e2e/ruin.spec.ts checks its content).
  await api(page, (a) => a.advance(800));
  await expect(page.getByText('Knife ruined')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');
});
