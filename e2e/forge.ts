import { expect, type Page } from '@playwright/test';

/** The debug API as the S4 and S5 checks use it (forge spec, Debug API). */
export type Box = { x: number; y: number; width: number; height: number };
export type Api = {
  setSeed(n: number): void;
  state(): {
    location: string;
    temp: number;
    ruin: string | null;
    quenchC: number | null;
    alloy: Record<string, number>;
    rulesVersion: number;
    bandShiftC: number;
    props: { bandLowC: number; bandHighC: number };
    targets: { x: number; y: number; hits: number }[];
    slag: { x: number; y: number; gap: number; cleared: boolean }[];
    strikes: { kind: string; slag?: number; force: number; crack: boolean; lines: { cause: string; points: number }[]; heat: 'cold' | 'in' | 'hot'; offPx: number | null; perfect: boolean }[];
  } | null;
  /** The last strike's first hammer play and whether a second (Perfect) ring played; null before any strike. */
  lastSound(): { key: string; rate: number; perfect: boolean } | null;
  /** The striking finger's hold so far: engine steps and the force they give. */
  hold(): { steps: number; force: number };
  /** Engine steps of holding that give the ideal force at the temperature now. */
  idealHold(): number;
  /** The strike targets' centres in CSS px, relative to the page. */
  targets(): { x: number; y: number; hits: number }[];
  /** The slag spots' centres in CSS px, relative to the page. */
  slag(): { x: number; y: number; cleared: boolean }[];
  /** Mark every slag spot cleared. */
  clearSlag(): void;
  pause(): void;
  advance(ms: number): void;
  send(input: unknown): void;
  pinTemp(c: number | null): void;
  metalBox(): Box;
  zone(name: 'fire' | 'anvil' | 'tub'): Box;
};
type Win = { __artifice: Api };

export const api = <T>(page: Page, fn: (a: Api) => T) =>
  page.evaluate((src) => new Function('a', `return (${src})(a)`)((window as unknown as Win).__artifice), fn.toString()) as Promise<T>;

/** Start a knife with a fixed seed, pause real time, hold the heat at `temp` and put it on the anvil. */
export async function knifeOnAnvil(page: Page, temp: number, url = '/?debug') {
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { __artifice?: Api }).__artifice != null);
  await api(page, (a) => a.setSeed(42));
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap(); // the default mix (S5)
  await page.waitForFunction(() => (window as unknown as Win).__artifice.state?.() != null);
  await page.evaluate((t) => {
    const a = (window as unknown as Win).__artifice;
    a.pause();
    a.pinTemp(t);
    a.send({ grab: true });
    a.advance(16);
    a.send({ drop: 'anvil' });
    a.advance(32);
  }, temp);
  await expect(page.getByRole('button', { name: 'Back to the fire' })).toBeVisible();
}

/** Mark every slag spot cleared, so a check that strikes targets directly doesn't depend on the seed's slag (S3). */
export const clearSlag = (page: Page) => api(page, (a) => a.clearSlag());

/**
 * With a finger down, advance the engine by the steps that give the ideal force at the temperature now (a plain tap is
 * light since S2), so the lift that follows strikes with the right force.
 */
export async function holdForIdeal(page: Page) {
  await page.evaluate(() => {
    const a = (window as unknown as Win).__artifice;
    a.advance(a.idealHold() * 16);
  });
}

/** Strike close-view game px (x, y) through the engine and let the step run. */
export async function strike(page: Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => {
    const a = (window as unknown as Win).__artifice;
    a.send({ strike: { x, y } });
    a.advance(16);
  }, { x, y });
}

/**
 * Wait two frames, so a panel that changed height has been laid out again (its ResizeObserver runs within a frame)
 * before a test measures where the scene draws things. Measured too early, the tub could move before the drop.
 */
export const settle = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

/** Drag the piece from where it is drawn and let go over a drop zone's middle, through the real touch controls. */
export async function dragTo(page: Page, zone: 'fire' | 'anvil' | 'tub') {
  await settle(page);
  const b = await api(page, (a) => a.metalBox());
  const z = await page.evaluate((n) => (window as unknown as Win).__artifice.zone(n), zone);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 });
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
}
