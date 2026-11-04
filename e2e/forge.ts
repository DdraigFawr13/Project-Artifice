import { expect, type Page } from '@playwright/test';

/** The debug API as the S4 checks use it (forge spec, Debug API). */
export type Box = { x: number; y: number; width: number; height: number };
export type Api = {
  setSeed(n: number): void;
  state(): { location: string; temp: number; ruin: string | null; quenchC: number | null; targets: { x: number; y: number; hits: number }[] } | null;
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

/** Strike close-view game px (x, y) through the engine and let the step run. */
export async function strike(page: Page, x: number, y: number) {
  await page.evaluate(({ x, y }) => {
    const a = (window as unknown as Win).__artifice;
    a.send({ strike: { x, y } });
    a.advance(16);
  }, { x, y });
}

/** Drag the piece from where it is drawn and let go over a drop zone's middle, through the real touch controls. */
export async function dragTo(page: Page, zone: 'fire' | 'anvil' | 'tub') {
  const b = await api(page, (a) => a.metalBox());
  const z = await page.evaluate((n) => (window as unknown as Win).__artifice.zone(n), zone);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(z.x + z.width / 2, z.y + z.height / 2, { steps: 8 });
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
}
