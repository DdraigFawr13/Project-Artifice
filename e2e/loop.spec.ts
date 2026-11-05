import { expect, test, type Page } from '@playwright/test';
import { api, dragTo, type Api } from './forge';

// J5 Full loop (forge spec; S5 "Settled at S5 start"): mix a 3-ore alloy through the real − and + buttons, craft a knife,
// forge another with the same mix, ruin it for scrap, then reload: the best and the scrap show on the item list.

const more = (page: Page, ore: string) => page.getByRole('button', { name: `More ${ore}`, exact: true });
const less = (page: Page, ore: string) => page.getByRole('button', { name: `Less ${ore}`, exact: true });
const start = (page: Page) => page.getByRole('button', { name: 'Start forging' });
const reason = (page: Page) => page.getByTestId('mix-reason');
const oreRow = (page: Page, ore: string) => page.getByTestId('ore-row').filter({ hasText: ore });

/** Pause the forge, hold the heat at `temp`, pick the piece up for the quench and let go over the tub. */
async function quenchAt(page: Page, temp: number) {
  await page.waitForFunction(() => (window as unknown as { __artifice: { state(): unknown } }).__artifice.state() != null);
  await page.evaluate((t) => {
    const a = (window as unknown as { __artifice: Api }).__artifice;
    a.pause();
    a.pinTemp(t);
    a.advance(32);
  }, temp);
  await page.getByRole('button', { name: 'Quench' }).click();
  await api(page, (a) => a.advance(48));
  await dragTo(page, 'tub');
  await api(page, (a) => a.advance(1600));
}

test('mix a 3-ore alloy, craft a knife, forge another, reload: best and scrap kept', async ({ page }, testInfo) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: unknown }).__artifice != null);
  await page.getByRole('button', { name: 'Forge a knife' }).tap();

  // Alloy (mock-up frame 2): the Alloy step lit, the item named, the knife's default mix (Ore 2 ×4, Ore 1 ×1).
  await expect(page.locator('.top .steps .on')).toHaveText('Alloy');
  await expect(page.locator('.top')).toContainText('Knife');
  await expect(page.getByText('Mix the metal for your knife from 2–3 ores.')).toBeVisible();
  await expect(page.getByTestId('ore-row')).toHaveCount(3);
  await expect(oreRow(page, 'Bog Iron')).toContainText('Quality 40 · 1 part');
  await expect(oreRow(page, 'Ridge Iron')).toContainText('Quality 60 · 4 parts');
  await expect(oreRow(page, 'Starmetal')).toContainText('Quality 85 · 0 parts');
  await expect(oreRow(page, 'Starmetal')).toContainText('Hard to work: a narrow working heat, and it cools fast.');
  await expect(page.getByTestId('alloy-hint')).toHaveText('Tap − and + to share the parts between the ores. Better ore is harder to work.');
  await expect(page.getByTestId('alloy-quality')).toHaveText('Material quality 56');
  await expect(start(page)).toBeEnabled();
  await expect(reason(page)).toBeHidden();
  // The share bar is the ore's parts out of the item's: 4 of 5.
  const bar = await oreRow(page, 'Ridge Iron').locator('.bar').evaluate((b) => (b.firstElementChild as HTMLElement).getBoundingClientRect().width / b.clientWidth);
  expect(bar).toBeCloseTo(0.8, 1);
  // At the item's total, + is off for every ore.
  await expect(more(page, 'Starmetal')).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('alloy.png') });

  // Refused: short of the total.
  await less(page, 'Ridge Iron').tap();
  await less(page, 'Ridge Iron').tap();
  await expect(start(page)).toBeDisabled();
  await expect(reason(page)).toBeVisible();
  await expect(reason(page)).toHaveText('Add 2 more parts: a knife takes 5.');
  // Hidden, not just empty: an empty line still takes a row in the panel.
  await expect(page.getByTestId('alloy-quality')).toHaveJSProperty('hidden', true);
  // Refused: one ore at the right total.
  await less(page, 'Bog Iron').tap();
  await more(page, 'Ridge Iron').tap();
  await more(page, 'Ridge Iron').tap();
  await more(page, 'Ridge Iron').tap();
  await expect(reason(page)).toHaveText('Mix at least 2 ores.');
  await expect(start(page)).toBeDisabled();
  // Refused: empty (mock-up frame 2b); − is off at 0.
  for (let i = 0; i < 5; i++) await less(page, 'Ridge Iron').tap();
  await expect(less(page, 'Ridge Iron')).toBeDisabled();
  await expect(reason(page)).toHaveText('Add at least one part of ore first.');
  await expect(start(page)).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('alloy-empty.png') });

  // A 3-ore mix: Ore 1 ×1, Ore 2 ×2, Ore 3 ×2. Quality (40 + 120 + 170) ÷ 5 = 66.
  await more(page, 'Bog Iron').tap();
  await more(page, 'Ridge Iron').tap();
  await more(page, 'Ridge Iron').tap();
  await more(page, 'Starmetal').tap();
  await more(page, 'Starmetal').tap();
  await expect(page.getByTestId('alloy-quality')).toHaveText('Material quality 66');
  await expect(start(page)).toBeEnabled();
  await api(page, (a) => a.setSeed(7));
  await start(page).tap();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  expect((await api(page, (a) => a.state()!.alloy))).toEqual({ ore1: 1, ore2: 2, ore3: 2 });

  // Craft: quench in the band with no strikes. 18 hits missing, −90: 10.
  await quenchAt(page, 830);
  await expect(page.getByTestId('score')).toHaveText('10');
  await expect(page.getByTestId('material')).toHaveText('Material quality 66 · not in the score');

  // Forge another skips the alloy screen and keeps the mix.
  await page.getByRole('button', { name: 'Forge another' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  expect((await api(page, (a) => a.state()!.alloy))).toEqual({ ore1: 1, ore2: 2, ore3: 2 });

  // Ruin it at white heat: half of 5 parts, rounded down, comes back as scrap. Try again keeps the mix too.
  await quenchAt(page, 1275);
  await expect(page.getByText('Knife ruined')).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  expect((await api(page, (a) => a.state()!.alloy))).toEqual({ ore1: 1, ore2: 2, ore3: 2 });

  // Reload mid-craft abandons it; the list shows the best and the scrap.
  await page.reload();
  await expect(page.getByTestId('item-row').filter({ hasText: 'Knife' })).toContainText('Best: 10');
  await expect(page.getByText('Scrap kept: 2 parts')).toBeVisible();
  // The mix lives in the page, not the save: after a reload the alloy screen starts from the default again.
  await page.getByRole('button', { name: 'Forge a knife' }).tap();
  await expect(oreRow(page, 'Ridge Iron')).toContainText('4 parts');
  await expect(oreRow(page, 'Starmetal')).toContainText('0 parts');
  // The alloy hint was counted for each time the screen opened before the craft ended, and written with it.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('artifice.save')!));
  expect(saved.hintsSeen.alloy).toBe(1);
});

test('Choose item reopens the alloy screen with the last mix; Back to the list goes back', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: unknown }).__artifice != null);
  await page.getByTestId('item-row').filter({ hasText: 'Horseshoe' }).tap();
  await page.getByRole('button', { name: 'Forge a horseshoe' }).tap();
  // The horseshoe's default: Ore 2 ×2, Ore 1 ×1. Make it Ore 2 ×1, Ore 3 ×2.
  await expect(oreRow(page, 'Ridge Iron')).toContainText('2 parts');
  await less(page, 'Bog Iron').tap();
  await less(page, 'Ridge Iron').tap();
  await more(page, 'Starmetal').tap();
  await more(page, 'Starmetal').tap();
  await expect(page.getByTestId('alloy-quality')).toHaveText('Material quality 77');
  await start(page).tap();
  await quenchAt(page, 830);
  await page.getByRole('button', { name: 'Choose item' }).click();
  await expect(page.getByRole('button', { name: 'Forge a horseshoe' })).toBeVisible();
  await page.getByRole('button', { name: 'Forge a horseshoe' }).tap();
  await expect(oreRow(page, 'Bog Iron')).toContainText('0 parts');
  await expect(oreRow(page, 'Ridge Iron')).toContainText('1 part');
  await expect(oreRow(page, 'Starmetal')).toContainText('2 parts');
  // Another item keeps its own default.
  await page.getByRole('button', { name: 'Back to the list' }).tap();
  await expect(page.getByTestId('item-row')).toHaveCount(3);
  await page.getByTestId('item-row').filter({ hasText: 'Sword' }).tap();
  await page.getByRole('button', { name: 'Forge a sword' }).tap();
  await expect(oreRow(page, 'Ridge Iron')).toContainText('7 parts');
  await expect(oreRow(page, 'Bog Iron')).toContainText('1 part');
});

test('the alloy hint shows the first 3 times the screen opens, then stops', async ({ page }) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __artifice?: unknown }).__artifice != null);
  for (let i = 1; i <= 4; i++) {
    await page.getByRole('button', { name: 'Forge a knife' }).tap();
    await expect(page.getByTestId('ore-row')).toHaveCount(3);
    await expect(page.getByTestId('alloy-hint')).toHaveCount(i <= 3 ? 1 : 0);
    await page.getByRole('button', { name: 'Back to the list' }).tap();
  }
});
