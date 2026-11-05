import { expect, test } from '@playwright/test';
import { api, clearSlag, dragTo, knifeOnAnvil, settle, strike } from './forge';

// J4 Quench and grade (forge spec; S4 "Settled at S4 start"). A scripted knife: every hit dead centre in the working
// heat except one wild strike and one hit left missing, then Quench and a drag to the tub a little hot (905 °C).
// Expected: 100 − 2 (wild) − 5 (one hit missing) − 1 (25 °C over 880) = 92, Masterwork.
test('a scripted knife is quenched in the tub and graded line by line', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
  await clearSlag(page);
  const targets = (await api(page, (a) => a.state()))!.targets;
  for (const t of targets) await strike(page, t.x, t.y);
  for (const t of targets.slice(0, 8)) await strike(page, t.x, t.y);
  await strike(page, 20, 100); // far from the blade: wild

  // Quench: the wide view with the piece in hand, the Quench step lit, frame 5's panel and the quench hint.
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!.location).toBe('held');
  await expect(page.locator('.top .steps .on')).toHaveText('Quench');
  await expect(page.getByTestId('quench-intro')).toHaveText('Read the metal, then plunge it. The right moment is in its colour, glow and sparks.');
  await expect(page.getByTestId('quench-hint')).toHaveText('Drag the piece to the tub and let go to quench.');
  await expect(page.getByRole('button', { name: 'Back to the anvil' })).toBeVisible();
  await expect(page.getByTestId('tub-label')).toBeVisible();
  await expect(page.getByTestId('tub-label')).toHaveText('Quench tub');
  await page.screenshot({ path: testInfo.outputPath('quench.png') });

  await api(page, (a) => a.pinTemp(905));
  await dragTo(page, 'tub');
  const s = (await api(page, (a) => a.state()))!;
  expect(s).toMatchObject({ location: 'done', quenchC: 905, ruin: null });
  await api(page, (a) => a.advance(1600));

  await expect(page.getByTestId('score')).toHaveText('92');
  await expect(page.getByTestId('tier')).toHaveText('Masterwork');
  await expect(page.getByTestId('material')).toHaveText('Material quality 56 · not in the score');
  await expect(page.getByText('Knife finished')).toBeVisible();
  await expect(page.getByTestId('line')).toHaveText([
    /^Start\s*100$/,
    /^1 strike missed the metal\s*−2$/,
    /^1 hit missing\s*−5$/,
    /^Quenched too hot\s*−1$/,
  ]);
  await expect(page.getByText('New best for a knife.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('result.png') });

  // The best survives a reload, and "Forge another" starts the same item.
  await page.reload();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: 92');
  // The hint counts were written with the craft: each step's hint shown once.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('artifice.save')!));
  expect(saved.hintsSeen).toEqual({ alloy: 1, heat: 1, hammer: 1, force: 1, quench: 1 }); // slag waits: 2 hints at most
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap(); // the default mix (S5)
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
});

test('the result offers Choose item and Forge another', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(32);
  });
  await dragTo(page, 'tub');
  await api(page, (a) => a.advance(1600));
  // No strikes: all 18 hits missing (90 points) and the default knife's 3 slag spots (9 points), so 1 and Crude.
  await expect(page.getByTestId('score')).toHaveText('1');
  await expect(page.getByTestId('tier')).toHaveText('Crude');
  await page.getByRole('button', { name: 'Forge another' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  await expect(page.locator('.top')).toContainText('Knife');

  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(32));
  // "Back to the anvil" returns to the close view; Quench again, then the fire takes it for a reheat.
  // White heat in hand: the alert's advice fits the quench, not the fire.
  await api(page, (a) => { a.pinTemp(1275); a.advance(32); });
  await expect(page.getByRole('alert')).toContainText('Let it cool before you quench it.');
  await api(page, (a) => { a.pinTemp(950); a.advance(32); });
  await page.getByRole('button', { name: 'Back to the anvil' }).click();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!.location).toBe('anvil');
  await expect(page.getByRole('button', { name: 'Back to the fire' })).toBeVisible();
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(32));
  await dragTo(page, 'fire');
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');

  await page.getByRole('button', { name: 'To the anvil' }).click();
  await api(page, (a) => a.advance(64));
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(32));
  await dragTo(page, 'tub');
  await api(page, (a) => a.advance(1600));
  await page.getByRole('button', { name: 'Choose item' }).click();
  await expect(page.getByRole('button', { name: 'Forge a knife' })).toBeVisible();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: 1');
});

test('the piece can go from the fire straight to the quench', async ({ page }, testInfo) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: unknown }).__artifice != null);
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await page.getByRole('button', { name: 'Start forging' }).tap(); // the default mix (S5)
  await page.waitForFunction(() => (window as unknown as { __artifice: { state(): unknown } }).__artifice.state() != null);
  await api(page, (a) => {
    a.pause();
    a.pinTemp(830);
    a.advance(32);
  });
  await page.screenshot({ path: testInfo.outputPath('wide.png') });
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(48));
  expect((await api(page, (a) => a.state()))!.location).toBe('held');
  await expect(page.locator('.top .steps .on')).toHaveText('Quench');
  // Back where it came from: the fire.
  await page.getByRole('button', { name: 'Back to the fire' }).click();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(48));
  await dragTo(page, 'tub');
  expect((await api(page, (a) => a.state()))!).toMatchObject({ location: 'done', quenchC: 830 });
  await api(page, (a) => a.advance(1600));
  await expect(page.getByTestId('score')).toHaveText('1');
});

// S5 (Morgan: "the quench does feel very flat"): the piece sinks where it went in, steam rises, then the result opens.
test('a quench holds the tub view while the piece sinks, then shows the result', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(32);
  });
  await dragTo(page, 'tub');
  const start = await api(page, (a) => a.metalBox());
  await page.screenshot({ path: testInfo.outputPath('quench-plunge.png') });
  // The label would cover the piece going in.
  await expect(page.getByTestId('tub-label')).toBeHidden();
  await api(page, (a) => a.advance(400));
  const mid = await api(page, (a) => a.metalBox());
  await page.screenshot({ path: testInfo.outputPath('quench-sink.png') });
  // Going under: the part above the water gets shorter.
  expect(mid.height).toBeLessThan(start.height);
  // Sinking: its top is lower than when it went in, and the result isn't up yet.
  expect(mid.y).toBeGreaterThan(start.y);
  await api(page, (a) => a.advance(500));
  await expect(page.getByTestId('score')).toHaveCount(0);
  expect((await api(page, (a) => a.metalBox())).y).toBeGreaterThan(mid.y);
  await api(page, (a) => a.advance(700));
  await expect(page.getByTestId('score')).toHaveText('1');
});

// S5 (Morgan: "It didn't quench a few times"): a drop is judged where the finger lets go. Judged by the piece's
// centre, a knife grabbed near its right end and let go with the finger over the water's left edge went back to the anvil.
test('letting go with the finger over the water quenches, wherever the piece was grabbed', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(48);
  });
  await settle(page);
  const b = await api(page, (a) => a.metalBox());
  const tub = await api(page, (a) => a.zone('tub'));
  const k = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => c.getBoundingClientRect().width / c.width);
  // wide.png (320, 500): the water's left edge, 28 and 20 game px into the tub zone (292, 480).
  const over = { x: tub.x + 28 * k, y: tub.y + 20 * k };
  await page.mouse.move(b.x + b.width - 6, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(over.x, over.y, { steps: 8 });
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!).toMatchObject({ location: 'done', quenchC: 830 });
});

// A panel that changes height mid-drag must not move the scene under the finger: the tub stays where the player saw
// it until the drop, then the layout catches up. Laid out at once, the tub moved off the finger and the drop missed.
test('the scene holds still under a dragging finger while the panel changes height', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(830);
    a.advance(48);
  });
  await settle(page);
  const b = await api(page, (a) => a.metalBox());
  const tub = await api(page, (a) => a.zone('tub'));
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(tub.x + tub.width / 2, tub.y + 10, { steps: 8 });
  // The panel grows by 120 px while the finger is down.
  await page.evaluate(() => {
    const extra = document.createElement('div');
    extra.style.height = '120px';
    document.querySelector('.panel')!.append(extra);
  });
  await settle(page);
  expect(await api(page, (a) => a.zone('tub'))).toEqual(tub);
  await page.mouse.up();
  await api(page, (a) => a.advance(32));
  expect((await api(page, (a) => a.state()))!).toMatchObject({ location: 'done', quenchC: 830 });
  // After the drop the layout catches up with the taller panel.
  await settle(page);
  expect((await api(page, (a) => a.zone('tub'))).y).not.toBe(tub.y);
});

test('a layout held back by a drag catches up once the piece lands', async ({ page }) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Back to the fire' }).click();
  await api(page, (a) => a.advance(48));
  await settle(page);
  const b = await api(page, (a) => a.metalBox());
  const fire = await api(page, (a) => a.zone('fire'));
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  // Lifted and let go over the fire again: the panel stays the same, so only the held-back layout can move the scene.
  await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2 - 20, { steps: 8 });
  await page.evaluate(() => {
    const extra = document.createElement('div');
    extra.style.height = '120px';
    document.querySelector('.panel')!.append(extra);
  });
  await settle(page);
  expect(await api(page, (a) => a.zone('fire'))).toEqual(fire);
  await page.mouse.up();
  // The queued bellows-off, grab and drop take a step each.
  await api(page, (a) => a.advance(64));
  expect((await api(page, (a) => a.state()))!.location).toBe('fire');
  await settle(page);
  expect((await api(page, (a) => a.zone('fire'))).y).not.toBe(fire.y);
});
