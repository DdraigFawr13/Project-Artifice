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
    strokes: number[];
    grindScore: number | null;
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
  /** The cutting edge's ends in CSS px, relative to the page. */
  edgeLine(): { x0: number; y0: number; x1: number; y1: number };
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

/** The sinking hold after the drop (QUENCH_S 1.6 s of engine time) plus a margin, before the grind view takes strokes. */
const SINK_MS = 1700;

/** One frame of real time, so a mouse event that Phaser queues has been handled before the next engine step. */
const frame = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

/**
 * One whetstone stroke through the real mouse, along the knife's edge from end to end. The browser reports whole CSS px
 * and the game rounds to whole game px (13 per 16 CSS px at the Pixel's size), so the points sit on whole CSS px: a
 * step of 12 CSS px is 9.75 game px, nearly even, and a straight stroke scores about 97 (the engine's own tests show
 * exactly 100). `wavy` alternates about 6 game px either side of the edge. One engine step (16 ms) runs per point,
 * as the engine's one-point-per-step sampling expects; `stepsPerMove` runs more, as when two steps fall in one frame.
 */
export async function grindStroke(page: Page, wavy = false, stepsPerMove = 1) {
  const e = await api(page, (a) => a.edgeLine());
  const k = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width / c.width);
  const step = 12;
  const count = Math.floor((e.x1 - e.x0) / step);
  const x0 = Math.round(e.x0);
  // The whole CSS px whose game px (rounded) is the edge's y: the one nearest the edge.
  const y0 = Math.round(e.y0);
  const off = Math.round(6 / k);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await frame(page);
  for (let i = 1; i <= count; i++) {
    await page.mouse.move(x0 + i * step, y0 + (wavy ? (i % 2 === 0 ? -off : off) : 0));
    await frame(page);
    await page.evaluate((ms) => (window as unknown as Win).__artifice.advance(ms), 16 * stepsPerMove);
  }
  await page.mouse.up();
  await frame(page);
  await api(page, (a) => a.advance(32));
}

/**
 * The same grind without the mouse: two exact strokes (a point per px along the knife's edge, so each scores 100),
 * for checks about what the grind does rather than about the finger.
 */
export async function grindExact(page: Page) {
  await sinkIntoGrind(page);
  await page.evaluate(() => {
    const a = (window as unknown as Win).__artifice;
    // The edge's ends in close-view game px: from its CSS px, through the first target, which both views give.
    const e = a.edgeLine();
    const t = a.targets()[0]!;
    const g = a.state()!.targets[0]!;
    const c = document.querySelector('#game canvas') as HTMLCanvasElement;
    const perCss = c.width / c.getBoundingClientRect().width;
    const toGame = (cssX: number, cssY: number) => ({ x: Math.round(g.x + (cssX - t.x) * perCss), y: Math.round(g.y + (cssY - t.y) * perCss) });
    const p0 = toGame(e.x0, e.y0);
    const p1 = toGame(e.x1, e.y1);
    const points = Array.from({ length: p1.x - p0.x + 1 }, (_, i) => ({ x: p0.x + i, y: p0.y }));
    for (let n = 0; n < 2; n++) {
      a.send({ stroke: points });
      a.advance(16);
    }
    a.advance(900);
  });
}

/** After a quench: wait out the sinking hold, make both strokes of the grind, then the end hold, so the result opens. */
export async function grindKnife(page: Page, wavy = false) {
  await sinkIntoGrind(page);
  await grindStroke(page, wavy);
  await grindStroke(page, wavy);
  await api(page, (a) => a.advance(900));
}

/** Wait out the sinking hold only: the grind view is open and no stroke has been made. */
export const sinkIntoGrind = async (page: Page) => {
  await page.evaluate((ms) => (window as unknown as Win).__artifice.advance(ms), SINK_MS);
  await settle(page);
};
