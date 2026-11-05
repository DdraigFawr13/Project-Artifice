import { expect, test, type Page } from '@playwright/test';
import { api, type Api, clearSlag, dragTo, grindExact, grindKnife, grindStroke, holdForIdeal, knifeOnAnvil, settle, sinkIntoGrind, strike } from './forge';

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
  await grindKnife(page);
  await expect(page.getByTestId('line').filter({ hasText: 'slag' })).toHaveText([/^1 strike blocked by slag\s*−1$/, /^2 slag spots left\s*−6$/]);
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
  await grindKnife(page);
  await expect(page.getByTestId('score')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('artifice.save')!));
  expect(saved.hintsSeen.slag).toBe(1);
});

// J5 on screen (forge-depth spec, S4): a finished knife shows its stat card, and the item list keeps the best
// word of each stat across a reload.
test('a finished knife shows 3 stats with words and reasons, and the list keeps them after a reload', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const s0 = (await api(page, (a) => a.state()))!;
  await pin(page, (s0.props.bandLowC + s0.props.bandHighC) / 2);
  for (let round = 0; round < 2; round++) for (const t of s0.targets) await strike(page, t.x, t.y);
  await page.getByRole('button', { name: 'Quench' }).click();
  // Lift the piece while it is still in the band, then cool it to 830 °C in the hand: a step on the anvil below the band would cost Toughness.
  await api(page, (a) => {
    a.advance(48);
    a.send({ grab: true });
    a.advance(16);
    a.pinTemp(830);
    a.advance(16);
    a.send({ drop: 'tub' });
    a.advance(16);
  });
  await grindExact(page); // two exact strokes: grind 100, so Edge is the hammer's 83 still

  // The default mix (Ridge Iron x 4, Bog Iron x 1), every hit dead centre: work 100 x the mix's multipliers.
  await expect(page.getByTestId('score')).toHaveText('100');
  await expect(page.getByTestId('stat-card')).toBeVisible();
  const rows = page.getByTestId('stat-row');
  await expect(rows).toHaveCount(3);
  const expected = [
    ['Edge', 'Keen', 'helped by the Ridge Iron in the mix'],
    ['Toughness', 'Sturdy', 'helped by the Bog Iron in the mix'],
    ['Balance', 'Perfect', 'helped by the Ridge Iron in the mix'],
  ];
  for (const [i, [name, word, why]] of expected.entries()) {
    await expect(rows.nth(i).locator('b')).toHaveText(name!);
    await expect(rows.nth(i).locator('.word')).toHaveText(word!);
    await expect(rows.nth(i).locator('.why')).toHaveText(why!);
  }
  await expect(rows.nth(0).locator('.sbar i')).toHaveCSS('width', /^\d/); // the bar is drawn
  expect(await rows.nth(0).locator('.sbar i').evaluate((e) => (e as HTMLElement).style.width)).toBe('83%');
  // The card sits after the score lines and before the best line.
  const order = await page.locator('.screen.result .panel.fill > *').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? e.className));
  expect(order.indexOf('stat-card')).toBeGreaterThan(order.indexOf('material'));

  await page.reload();
  const knife = page.getByTestId('item-row').filter({ hasText: 'Knife' });
  await expect(knife).toContainText('Best: 100');
  await expect(knife.getByTestId('best-stats')).toHaveText('Edge Keen · Toughness Sturdy · Balance Perfect');
  await expect(page.getByTestId('best-stats')).toHaveCount(1); // the other items have no crafts
});

test('a fresh save shows no best-stats line', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('item-row').first()).toBeVisible();
  await expect(page.getByTestId('best-stats')).toHaveCount(0);
});

// J6 on screen (forge-depth spec, S5): a finished knife is drawn on the result in its mix's sheen, so different mixes look
// different. Expected colours: sheen x the knife's most common finished shade. The shade, 0.88, was measured by counting
// the shade of every piece pixel of worked(shapesFor('knife'), all targets hit twice), outline excluded (src/data/sheen.test.ts).
// Default mix (ore2 x 4, ore1 x 1): sheen (188, 175, 158) x 0.88 = (165, 154, 139).
// Ore1 x 1, ore2 x 2, ore3 x 2: sheen (137, 146, 176) x 0.88 = (121, 128, 155).
const OUTLINE = [0x12, 0x08, 0x14];

/** A knife with every slag spot cleared and every target struck twice, quenched in the band: the finished result. */
async function finishKnife(page: Page) {
  await clearSlag(page);
  const s0 = (await api(page, (a) => a.state()))!;
  const mid = (s0.props.bandLowC + s0.props.bandHighC) / 2;
  await pin(page, mid);
  for (let round = 0; round < 2; round++) for (const t of s0.targets) await strike(page, t.x, t.y);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(48));
  await dragTo(page, 'tub');
  await grindKnife(page);
  await expect(page.getByTestId('score')).toBeVisible();
}

/** The most common colour among the piece's opaque pixels, outline excluded; how many pixels are the outline colour; the canvas's size and CSS width. */
const readPiece = (page: Page) =>
  page.getByTestId('result-piece').evaluate((c: HTMLCanvasElement, outline) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const counts = new Map<string, number>();
    let outlinePx = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 255) continue;
      if (d[i] === outline[0] && d[i + 1] === outline[1] && d[i + 2] === outline[2]) {
        outlinePx++;
        continue;
      }
      const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0];
    return { rgb: top ? top[0].split(',').map(Number) : [], outlinePx, w: c.width, h: c.height, cssW: c.getBoundingClientRect().width };
  }, OUTLINE);

const near = (got: number[], want: number[]) => got.every((c, i) => Math.abs(c - want[i]!) <= 8);

test('a finished knife is drawn in its mix\'s sheen, and two mixes look different', async ({ page }) => {
  // The default mix, from the alloy screen's default.
  await knifeOnAnvil(page, 950);
  await finishKnife(page);
  await settle(page);
  const a = await readPiece(page);
  expect(near(a.rgb, [165, 154, 139]), `default mix drew ${a.rgb}`).toBe(true);
  // The outline is the forge's dark colour, untinted by the sheen: hundreds of pixels round the knife.
  expect(a.outlinePx).toBeGreaterThan(200);
  // Drawn above the score, and sized by the formula: round(w x min(2, 300 / w)) CSS px.
  const order = await page.locator('.screen.result .panel.fill > *').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? e.className));
  expect(order.indexOf('result-piece')).toBe(0);
  expect(a.cssW).toBe(Math.round(a.w * Math.min(2, 300 / a.w)));
  const piece = page.getByTestId('result-piece');
  await expect(piece).toHaveAttribute('role', 'img');
  await expect(piece).toHaveAttribute('aria-label', 'Knife in Ridge Iron and Bog Iron');
  await expect(piece).toHaveClass('piece');

  // Ore 1 x 1, Ore 2 x 2, Ore 3 x 2, set with the alloy screen's buttons.
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: Api }).__artifice != null);
  await api(page, (x) => x.setSeed(42));
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Less Ridge Iron', exact: true }).tap();
  await page.getByRole('button', { name: 'Less Ridge Iron', exact: true }).tap();
  await page.getByRole('button', { name: 'More Starmetal', exact: true }).tap();
  await page.getByRole('button', { name: 'More Starmetal', exact: true }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap();
  await page.waitForFunction(() => (window as unknown as { __artifice: Api }).__artifice.state?.() != null);
  await page.evaluate(() => {
    const x = (window as unknown as { __artifice: Api }).__artifice;
    x.pause();
    x.pinTemp(950);
    x.send({ grab: true });
    x.advance(16);
    x.send({ drop: 'anvil' });
    x.advance(32);
  });
  await expect(page.getByRole('button', { name: 'Back to the fire' })).toBeVisible();
  expect((await api(page, (x) => x.state()))!.alloy).toEqual({ ore1: 1, ore2: 2, ore3: 2 });
  await finishKnife(page);
  await settle(page);
  const b = await readPiece(page);
  expect(near(b.rgb, [121, 128, 155]), `3-ore mix drew ${b.rgb}`).toBe(true);
  expect(Math.max(...a.rgb.map((c, i) => Math.abs(c - b.rgb[i]!)))).toBeGreaterThanOrEqual(30);
  await expect(page.getByTestId('result-piece')).toHaveAttribute('aria-label', 'Knife in Ridge Iron, Starmetal and Bog Iron');
});

test('a ruined knife shows no piece', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (x) => {
    x.pinTemp(1275);
    x.advance(32);
  });
  await dragTo(page, 'tub');
  await api(page, (x) => x.advance(1600));
  await expect(page.getByText('Knife ruined')).toBeVisible();
  await expect(page.getByTestId('result-piece')).toHaveCount(0);
});

// J7 on screen (forge-depth spec, S6): after the quench a knife waits in the grind until 2 strokes of the stone, made with
// the real mouse. A straight pair scores about 97 (100 with exact points, as in the unit tests); a wavy pair scores about 50 to 70 and loses
// Edge; the craft's score is the same either way; a horseshoe never grinds.

/** A knife with the slag cleared, every target struck twice in the band, and quenched at 830 °C: waiting in the grind. */
async function quenchedKnife(page: Page) {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const s0 = (await api(page, (a) => a.state()))!;
  await pin(page, (s0.props.bandLowC + s0.props.bandHighC) / 2);
  for (let round = 0; round < 2; round++) for (const t of s0.targets) await strike(page, t.x, t.y);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(48));
  await pin(page, 830);
  await dragTo(page, 'tub');
  expect((await api(page, (a) => a.state()))!).toMatchObject({ location: 'grind', quenchC: 830, ruin: null });
}

/** Two strokes with the mouse, checking the craft waits in the grind between them; returns the numbers the screen shows. */
async function grindPair(page: Page, wavy: boolean) {
  await quenchedKnife(page);
  await sinkIntoGrind(page);
  await expect(page.locator('.top .steps .on')).toHaveText('Grind');
  await expect(page.getByTestId('stroke-label')).toHaveText('Stroke 1 of 2');
  await expect(page.getByTestId('grind-hint')).toHaveText('Drag the stone along the edge, steady and even.');
  await grindStroke(page, wavy);
  const mid = (await api(page, (a) => a.state()))!;
  expect(mid.location).toBe('grind');
  expect(mid.strokes).toHaveLength(1);
  await expect(page.getByTestId('stroke-label')).toHaveText('Stroke 2 of 2');
  await grindStroke(page, wavy);
  const end = (await api(page, (a) => a.state()))!;
  expect(end.location).toBe('done');
  expect(end.strokes).toHaveLength(2);
  await api(page, (a) => a.advance(900));
  await expect(page.getByTestId('score')).toBeVisible();
  const edge = page.getByTestId('stat-row').nth(0);
  return {
    grindScore: end.grindScore!,
    score: await page.getByTestId('score').innerText(),
    edgeBar: await edge.locator('.sbar i').evaluate((e) => (e as HTMLElement).style.width),
    edgeWhy: await edge.locator('.why').innerText(),
  };
}

test('a straight pair of strokes beats a wavy pair: Edge shows it, the score does not', async ({ page }) => {
  const straight = await grindPair(page, false);
  // A finger on whole pixels is a little uneven (the engine's own tests show exactly 100 for a perfect stroke).
  expect(straight.grindScore).toBeGreaterThan(85);
  expect(straight.edgeWhy).toMatch(/^(helped by the Ridge Iron in the mix|hurt most by an uneven grind)$/);

  const wavy = await grindPair(page, true);
  expect(wavy.grindScore).toBeGreaterThan(40);
  expect(wavy.grindScore).toBeLessThan(75);
  expect(wavy.grindScore).toBeLessThan(straight.grindScore - 20);
  // Edge = (50 + 0.5 × grind) × 0.83: about 80 for the straight pair, about 70 for the wavy, and the card names the grind.
  expect(parseInt(wavy.edgeBar)).toBeLessThan(parseInt(straight.edgeBar) - 10);
  expect(parseInt(straight.edgeBar)).toBeGreaterThan(75);
  expect(wavy.edgeWhy).toBe('hurt most by an uneven grind');
  // Guard: the score is the same with either grind.
  expect(wavy.score).toBe(straight.score);
  expect(straight.score).toBe('100');
});

// S6 review: steps (16 ms) and frames (16.7 ms at 60 Hz) don't line up, so now and then two steps run before the next
// pointer event. Repeating the point read as a stop and cost a steady stroke about 12 points; only new positions count.
test('a steady stroke scores the same when two engine steps run between pointer events', async ({ page }) => {
  await quenchedKnife(page);
  await sinkIntoGrind(page);
  await grindStroke(page, false, 2);
  const s = (await api(page, (a) => a.state()))!;
  expect(s.strokes).toHaveLength(1);
  expect(s.strokes[0]!).toBeGreaterThan(85);
});

// Final review: a stroke lifted over the panel was dropped silently. Its points were taken over the piece, so it counts.
test('a stroke that ends with the finger lifted over the panel still counts', async ({ page }) => {
  await quenchedKnife(page);
  await sinkIntoGrind(page);
  const e = await api(page, (a) => a.edgeLine());
  await page.mouse.move(Math.round(e.x0), Math.round(e.y0));
  await page.mouse.down();
  for (let x = Math.round(e.x0) + 12; x <= e.x1; x += 12) {
    await page.mouse.move(x, Math.round(e.y0));
    await page.evaluate(() => (window as unknown as { __artifice: Api }).__artifice.advance(16));
  }
  // Off the canvas, over the panel, then lift.
  const panel = await page.locator('.panel').first().boundingBox();
  await page.mouse.move(panel!.x + panel!.width / 2, panel!.y + panel!.height / 2);
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!.strokes).toHaveLength(1);
});

test('a press too short to be a stroke pops "Too short" and counts for nothing; the stone shows under the finger', async ({ page }) => {
  await quenchedKnife(page);
  await sinkIntoGrind(page);
  const e = await api(page, (a) => a.edgeLine());
  const k = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width / c.width);
  // Off the piece, on the anvil face, where only the stone changes the pixels.
  const at = { x: e.x0 + 20 * k, y: e.y0 + 40 * k };
  const before = await brightness(page, at, 3);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await api(page, (a) => a.advance(32)); // 2 points: under minPoints
  await settle(page);
  expect(Math.abs((await brightness(page, at, 3)) - before)).toBeGreaterThan(3); // the whetstone is drawn
  await page.mouse.up();
  await settle(page);
  await api(page, (a) => a.advance(16));
  await expect(page.getByTestId('points')).toHaveText('Too short');
  const s = (await api(page, (a) => a.state()))!;
  expect(s.strokes).toEqual([]);
  expect(s.location).toBe('grind');
  await expect(page.getByTestId('stroke-label')).toHaveText('Stroke 1 of 2');
  await api(page, (a) => a.advance(800));
  expect(await brightness(page, at, 3)).toBe(before); // the stone is gone with the finger
});

test('the grind hint shows the first 3 times the grind is reached, not after', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('artifice.save', JSON.stringify({ version: 1, best: {}, scrap: 0, hintsSeen: { grind: 3 } })));
  await quenchedKnife(page);
  await sinkIntoGrind(page);
  await expect(page.getByTestId('stroke-label')).toBeVisible();
  await expect(page.getByTestId('grind-hint')).toHaveCount(0);
});

test('a horseshoe has no Grind step: it goes from the quench straight to the result', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: Api }).__artifice != null);
  await page.getByTestId('item-row').filter({ hasText: 'Horseshoe' }).tap();
  await page.getByRole('button', { name: 'Forge a horseshoe' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap();
  await page.waitForFunction(() => (window as unknown as { __artifice: Api }).__artifice.state?.() != null);
  await expect(page.locator('.top .steps span')).toHaveText(['Alloy', 'Heat', 'Hammer', 'Quench']);
  await page.evaluate(() => {
    const x = (window as unknown as { __artifice: Api }).__artifice;
    x.pause();
    x.pinTemp(830);
    x.advance(32);
  });
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (x) => x.advance(48));
  await dragTo(page, 'tub');
  expect((await api(page, (x) => x.state()))!).toMatchObject({ location: 'done', quenchC: 830, strokes: [], grindScore: null });
  await api(page, (x) => x.advance(1600));
  await expect(page.getByTestId('score')).toBeVisible();
  await expect(page.getByTestId('stroke-label')).toHaveCount(0);
  await expect(page.getByTestId('stat-row')).toHaveCount(2); // Toughness and Balance only
});
