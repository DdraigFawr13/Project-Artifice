import { expect, test, type Page } from '@playwright/test';

// J3 Hammer (docs/specs/forge-prototype.md; S3 "Settled at S3 start"). Reads a target from the debug API, touches
// 40 game px below it and lifts; that target is marked struck and the strike count rises.
type Pt = { x: number; y: number; struck: boolean };
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
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  await frames(page);
}

test('a lift 40 game px below a target strikes it', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
  await expect(page.locator('.top .steps .on')).toHaveText('Hammer');
  await expect(page.getByTestId('hammer-hint')).toHaveText('Strike the marked spots. Your strike lands at the ring above your thumb when you lift it.');
  const targets = await api(page, (a) => a.targets());
  expect(targets).toHaveLength(9);
  expect((await api(page, (a) => a.state()))!.targets).toHaveLength(9);
  await expect(page.getByTestId('strikes')).toHaveText('Strikes 0 of 9 · −0');

  await strikeAt(page, targets[4]!);
  const s = (await api(page, (a) => a.state()))!;
  expect(s.strikes).toHaveLength(1);
  expect(s.strikes[0]!.kind).toBe('hit');
  // Exactly 40 game px above the touch: a centre hit costs nothing.
  expect(s.strikes[0]!.lines).toEqual([]);
  expect(s.targets[4]!.struck).toBe(true);
  expect((await api(page, (a) => a.targets()))[4]!.struck).toBe(true);
  expect(s.targets.filter((t) => t.struck)).toHaveLength(1);
  await expect(page.getByTestId('strikes')).toHaveText('Strikes 1 of 9 · −0');
  await expect(page.getByTestId('points')).toHaveText('Clean');

  // About 6 game px off-centre: the strike costs points, and the screen shows what the engine scored for it.
  // (Touch positions are rounded by the browser, so the exact distance comes from the engine, not from here.)
  const k = await cssPerGame(page);
  await strikeAt(page, { x: targets[6]!.x + 6 * k, y: targets[6]!.y });
  const off = (await api(page, (a) => a.state()))!.strikes[1]!;
  expect(off.kind).toBe('hit');
  const pts = Math.round(off.lines.reduce((t, l) => t + l.points, 0));
  expect(pts).toBeGreaterThan(0);
  await expect(page.getByTestId('points')).toHaveText(`−${pts}`);
  await expect(page.getByTestId('strikes')).toHaveText(`Strikes 2 of 9 · −${pts}`);
  await testInfo.attach('close-view', { body: await page.screenshot(), contentType: 'image/png' });
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

test('Back to the fire returns to the wide view; Quench waits for S4 with a reason', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await expect(page.getByRole('button', { name: 'Quench' })).toBeDisabled();
  await expect(page.getByText('Quenching comes in the next build.')).toBeVisible();
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
  expect(s).toMatchObject({ location: 'done', ruin: 'black-strikes' });
  await expect(page.getByText('Ruined')).toBeVisible();
  await page.getByRole('button', { name: 'Forge again' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');
});
