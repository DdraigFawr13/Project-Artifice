import { expect, test } from '@playwright/test';
import { api, dragTo, knifeOnAnvil, strike } from './forge';

// J4 ruin (forge spec; S4 "Settled at S4 start"): a quench at white heat ruins the knife; half its 5 parts, rounded
// down, come back as scrap, and the scrap is kept.
test('a quench at white heat shows the ruin screen and returns scrap', async ({ page }, testInfo) => {
  await knifeOnAnvil(page, 950);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => {
    a.pinTemp(1275);
    a.advance(32);
  });
  await dragTo(page, 'tub');
  expect((await api(page, (a) => a.state()))!).toMatchObject({ location: 'done', ruin: 'white-quench' });
  await api(page, (a) => a.advance(800));

  await expect(page.getByText('Knife ruined')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('The knife cracked in the quench.');
  await expect(page.getByRole('alert')).toContainText('It went into the water far too hot.');
  await expect(page.getByTestId('line')).toHaveText([/^Metal used\s*5 parts$/, /^Scrap returned\s*2 parts$/]);
  await expect(page.getByText('The ruin counts. Your best grades are unchanged.')).toBeVisible();
  await expect(page.getByTestId('score')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('ruin.png') });

  await page.reload();
  await expect(page.getByText('Scrap kept: 2 parts')).toBeVisible();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: none yet');
});

test('three strikes on black metal show the ruin screen; Try again starts the same item', async ({ page }) => {
  await knifeOnAnvil(page, 300);
  const targets = (await api(page, (a) => a.state()))!.targets;
  for (const t of targets.slice(0, 3)) await strike(page, t.x, t.y);
  await api(page, (a) => a.advance(800));
  await expect(page.getByRole('alert')).toContainText('The knife cracked on the anvil.');
  await expect(page.getByRole('alert')).toContainText('3 strikes on black, cold metal.');
  await expect(page.getByTestId('line')).toHaveText([/^Metal used\s*5 parts$/, /^Scrap returned\s*2 parts$/]);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  // The scrap was kept, and no quench hint was counted: this craft never reached the quench.
  await page.reload();
  await expect(page.getByText('Scrap kept: 2 parts')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('artifice.save')!));
  expect(saved.hintsSeen.quench).toBeUndefined();
});
