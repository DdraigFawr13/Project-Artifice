import { expect, test } from '@playwright/test';
import { api, dragTo, knifeOnAnvil, strike } from './forge';

// J4 Quench and grade (forge spec; S4 "Settled at S4 start"). A scripted knife: every hit dead centre in the working
// heat except one wild strike and one hit left missing, then Quench and a drag to the tub a little hot (905 °C).
// Expected: 100 − 2 (wild) − 3 (one hit missing) − 1 (25 °C over 880) = 94, Masterwork.
test('a scripted knife is quenched in the tub and graded line by line', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
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
  await api(page, (a) => a.advance(800));

  await expect(page.getByTestId('score')).toHaveText('94');
  await expect(page.getByTestId('tier')).toHaveText('Masterwork');
  await expect(page.getByTestId('material')).toHaveText('Material quality 56 · not in the score');
  await expect(page.getByText('Knife finished')).toBeVisible();
  await expect(page.getByTestId('line')).toHaveText([
    /^Start\s*100$/,
    /^1 strike missed the metal\s*−2$/,
    /^1 hit missing\s*−3$/,
    /^Quenched too hot\s*−1$/,
  ]);
  await expect(page.getByText('New best for a knife.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('result.png') });

  // The best survives a reload, and "Forge another" starts the same item.
  await page.reload();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: 94');
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
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
  await api(page, (a) => a.advance(800));
  // No strikes: all 18 hits missing, 54 points, so 46 and Common.
  await expect(page.getByTestId('score')).toHaveText('46');
  await expect(page.getByTestId('tier')).toHaveText('Common');
  await page.getByRole('button', { name: 'Forge another' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  await expect(page.locator('.top')).toContainText('Knife');

  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(32));
  // "Back to the anvil" returns to the close view; Quench again, then the fire takes it for a reheat.
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
  await api(page, (a) => a.advance(800));
  await page.getByRole('button', { name: 'Choose item' }).click();
  await expect(page.getByRole('button', { name: 'Forge a knife' })).toBeVisible();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: 46');
});
