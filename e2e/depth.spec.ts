import { expect, test, type Page } from '@playwright/test';
import { api, type Api, knifeOnAnvil, strike } from './forge';

/** Hold the temperature at `c` °C (a value passed through, since `api` callbacks can't close over variables). */
const pin = (page: Page, c: number) => page.evaluate((t) => (window as unknown as { __artifice: Api }).__artifice.pinTemp(t), c);

// J2 on screen (forge-depth spec, S1): the hammer's rate says where a strike landed against the shifted band,
// a Perfect strike rings twice and pops "Perfect", and a streak of clean strikes shows in the label.
test('the hammer rate follows the heat, and Perfect rings twice', async ({ page }) => {
  await knifeOnAnvil(page, 950);
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
  const { props } = (await api(page, (a) => a.state()))!;
  await pin(page, props.bandLowC - 5);
  await strike(page, 20, 100);
  expect((await api(page, (a) => a.state()))!.strikes.at(-1)).toMatchObject({ kind: 'wild', heat: 'cold', perfect: false });
  expect(await api(page, (a) => a.lastSound())).toEqual({ key: 'hammer', rate: 1, perfect: false });
});

test('three clean strikes in a row show "Clean ×3" in the label', async ({ page }) => {
  await knifeOnAnvil(page, 950);
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
