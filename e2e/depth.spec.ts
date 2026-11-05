import { expect, test, type Page } from '@playwright/test';
import { api, type Api, clearSlag, dragTo, holdForIdeal, knifeOnAnvil, strike } from './forge';

/** Hold the temperature at `c` °C (a value passed through, since `api` callbacks can't close over variables). */
const pin = (page: Page, c: number) => page.evaluate((t) => (window as unknown as { __artifice: Api }).__artifice.pinTemp(t), c);

// J2 on screen (forge-depth spec, S1): the hammer's rate says where a strike landed against the shifted band,
// a Perfect strike rings twice and pops "Perfect", and a streak of clean strikes shows in the label.
test('the hammer rate follows the heat, and Perfect rings twice', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  expect(await api(page, (a) => a.lastSound())).toBeNull();
  const s0 = (await api(page, (a) => a.state()))!;
  expect(s0.rulesVersion).toBe(2);
  const { bandLowC: lo, bandHighC: hi } = s0.props;
  const [t0, t1, t2, t3] = s0.targets;

  await pin(page, lo - 5);
  await strike(page, t0!.x + 4, t0!.y); // 4 px off: a hit, not Perfect
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 1.25, perfect: false });
  expect((await api(page, (a) => a.state()))!.strikes.at(-1)).toMatchObject({ heat: 'cold', perfect: false });

  await pin(page, hi + 5);
  await strike(page, t1!.x + 4, t1!.y);
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 0.8, perfect: false });
  expect((await api(page, (a) => a.state()))!.strikes.at(-1)).toMatchObject({ heat: 'hot', perfect: false });

  await pin(page, (lo + hi) / 2);
  await strike(page, t2!.x + 4, t2!.y);
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 1, perfect: false });
  await expect(page.getByTestId('points')).toHaveText(/^−\d+$/);

  await strike(page, t3!.x + 1, t3!.y); // within 1 px, in the band
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 1, perfect: true });
  expect((await api(page, (a) => a.state()))!.strikes.at(-1)).toMatchObject({ heat: 'in', offPx: 1, perfect: true });
  await expect(page.getByTestId('points')).toHaveText('Perfect');
});

test('a wild strike rings the anvil at rate 1', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const { props } = (await api(page, (a) => a.state()))!;
  await pin(page, props.bandLowC - 5);
  await strike(page, 20, 100);
  expect((await api(page, (a) => a.state()))!.strikes.at(-1)).toMatchObject({ kind: 'wild', heat: 'cold', perfect: false });
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 1, perfect: false });
});

test('three clean strikes in a row show "Clean ×3" in the label', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const s0 = (await api(page, (a) => a.state()))!;
  await pin(page, (s0.props.bandLowC + s0.props.bandHighC) / 2);
  await strike(page, s0.targets[0]!.x, s0.targets[0]!.y);
  await strike(page, s0.targets[1]!.x, s0.targets[1]!.y);
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 2 of 9 · −0');
  await strike(page, s0.targets[2]!.x, s0.targets[2]!.y);
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 3 of 9 · −0 · Clean ×3');
  await strike(page, 20, 100); // wild: ends the streak
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 3 of 9 · −2');
});

// J3 on screen (forge-depth spec, S2): holding a press fills the force ring and sets the strike's force; a quick press
// is a light strike. The ring is checked by pixels: a clip around the strike point gets brighter as the arc fills.
const press = async (page: Page) => {
  const [t0] = await api(page, (a) => a.targets());
  const k = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width / c.width);
  await page.mouse.move(t0!.x, t0!.y + 40 * k);
  await page.mouse.down();
  return { t0: t0!, k };
};
const brightness = async (page: Page, c: { x: number; y: number }, r: number): Promise<number> => {
  const png = await page.screenshot({ clip: { x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r } });
  return page.evaluate(async (b64) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const cv = new OffscreenCanvas(img.width, img.height);
    const g = cv.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i]! + d[i + 1]! + d[i + 2]!;
    return sum / (d.length / 4);
  }, png.toString('base64'));
};

test('holding a press for 640 ms of engine time strikes with force 1: Too hard in the band', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  await press(page);
  await api(page, (a) => a.advance(640));
  expect(await api(page, (a) => a.hold())).toEqual({ steps: 40, force: 1 });
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  expect(await api(page, (a) => a.hold())).toEqual({ steps: 0, force: 0 });
  const k = (await api(page, (a) => a.state()))!.strikes.at(-1)!;
  expect(k).toMatchObject({ kind: 'hit', force: 1, crack: false });
  await expect(page.getByTestId('points')).toHaveText(/^Too hard −\d+$/);
});

test('a press held for the ideal force is a plain hit', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  await press(page);
  await holdForIdeal(page);
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  const k = (await api(page, (a) => a.state()))!.strikes.at(-1)!;
  expect(k).toMatchObject({ kind: 'hit', crack: false });
  expect(k.lines.map((l) => l.cause)).not.toContain('hard-strike');
});

test('a quick press is a light strike: nothing counts, "Too light"', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  await press(page);
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  const s = (await api(page, (a) => a.state()))!;
  expect(s.strikes.at(-1)).toMatchObject({ kind: 'light', crack: false });
  expect(s.targets.every((t) => t.hits === 0)).toBe(true);
  await expect(page.getByTestId('points')).toHaveText('Too light');
  await expect(page.getByTestId('strikes')).toHaveText('Round 1 · 0 of 9 · −0');
});

test('the force ring fills while a finger is down, and pause() freezes it', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const { t0, k } = await press(page);
  // The strike point is the target's position (the touch is 40 game px below); the ring is about 13 game px out.
  const r = 18 * k;
  const b0 = await brightness(page, t0, r);
  await api(page, (a) => a.advance(320)); // 20 steps: half the ring
  expect((await api(page, (a) => a.hold())).steps).toBe(20);
  const b1 = await brightness(page, t0, r);
  await api(page, (a) => a.advance(320));
  const b2 = await brightness(page, t0, r);
  expect(b1).toBeGreaterThan(b0);
  expect(b2).toBeGreaterThan(b1);
  expect(await brightness(page, t0, r)).toBe(b2); // paused: nothing moves
  await page.mouse.up();
});

test('with the force hint spent, the hammer and slag hints show; the cap is 2 hints', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('artifice.save', JSON.stringify({ version: 1, best: {}, scrap: 0, hintsSeen: { force: 3 } })));
  await knifeOnAnvil(page, 950);
  await expect(page.getByTestId('force-hint')).toHaveCount(0);
  await expect(page.getByTestId('hammer-hint')).toHaveText('Strike the marked spots. Your strike lands at the ring above your thumb when you lift it.');
  await expect(page.getByTestId('slag-hint')).toHaveText("Knock out the dark slag first. The spots beside it won't shape until it's gone.");
});

// J4 on screen (forge-depth spec, S3): spots are dark pits, a real held press clears one, a blocked strike pops
// "Slag first −1", and what is left at the quench shows on the result.
test('a press clears a slag spot, a strike beside another is blocked, and the result counts the spots left', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await expect(page.getByTestId('slag-hint')).toHaveCount(0); // hammer and force fill the first anvils' 2 hints
  const spots = await api(page, (a) => a.slag());
  expect(spots).toHaveLength(3);
  expect(spots.every((p) => !p.cleared)).toBe(true);
  const k = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width / c.width);
  const at = (p: { x: number; y: number }) => brightness(page, p, 2);
  const pit = await at(spots[0]!);

  // A real press 40 game px below the spot, held for the ideal force.
  await page.mouse.move(spots[0]!.x, spots[0]!.y + 40 * k);
  await page.mouse.down();
  await holdForIdeal(page);
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  const s1 = (await api(page, (a) => a.state()))!;
  expect(s1.strikes.at(-1)).toMatchObject({ kind: 'slag', slag: 0 });
  expect(s1.slag.map((p) => p.cleared)).toEqual([true, false, false]);
  expect(s1.targets.every((t) => t.hits === 0)).toBe(true);
  await expect(page.getByTestId('points')).toHaveText('Slag out');
  await api(page, (a) => a.advance(800)); // let the sparks, scale and popup clear
  expect((await api(page, (a) => a.slag()))[0]!.cleared).toBe(true);
  expect(await at(spots[0]!)).toBeGreaterThan(pit + 30); // the dark pit is gone

  // A strike on a target beside an uncleared spot is lost.
  const blocked = s1.targets[s1.slag[1]!.gap]!;
  await strike(page, blocked.x, blocked.y);
  const s2 = (await api(page, (a) => a.state()))!;
  expect(s2.strikes.at(-1)).toMatchObject({ kind: 'blocked', offPx: null });
  expect(s2.strikes.at(-1)!.lines).toEqual([{ cause: 'blocked-strike', points: 1 }]);
  expect(s2.targets[s1.slag[1]!.gap]!.hits).toBe(0);
  await expect(page.getByTestId('points')).toHaveText('Slag first −1');

  // Quench with 2 spots left.
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(32);
  });
  await dragTo(page, 'tub');
  await api(page, (a) => a.advance(1600));
  await expect(page.getByTestId('line').filter({ hasText: 'slag' })).toHaveText([/^1 strike on spots held by slag\s*−1$/, /^2 slag spots left\s*−6$/]);
});

test('the slag hint shows once the hammer and force hints are spent, and is counted when shown', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('artifice.save', JSON.stringify({ version: 1, best: {}, scrap: 0, hintsSeen: { hammer: 3, force: 3 } })));
  await knifeOnAnvil(page, 950);
  await expect(page.getByTestId('hammer-hint')).toHaveCount(0);
  await expect(page.getByTestId('force-hint')).toHaveCount(0);
  await expect(page.getByTestId('slag-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(32);
  });
  await dragTo(page, 'tub');
  await api(page, (a) => a.advance(1600));
  await expect(page.getByTestId('score')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('artifice.save')!));
  expect(saved.hintsSeen.slag).toBe(1);
});
