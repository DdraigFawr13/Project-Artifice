import { expect, test } from '@playwright/test';

// J1 Open the game (docs/specs/forge-prototype.md).
test('opens to the item list at ×3 on the Pixel size', async ({ page }, testInfo) => {
  // Record the loading screen as it appears, so a fast load can't hide it from the check.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="loading"]')) (window as unknown as { sawLoading: boolean }).sawLoading = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/?debug');

  // The loading screen comes first, then the item list.
  const rows = page.getByTestId('item-row');
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId('loading')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { sawLoading?: boolean }).sawLoading)).toBe(true);
  await expect(rows).toHaveText([/Horseshoe/, /Knife/, /Sword/]);
  await expect(page.getByText('Best: none yet')).toHaveCount(3);

  const info = await page.evaluate(() => (window as unknown as { __artifice: { info(): { scale: number; visibleWidth: number; visibleHeight: number; devicePixelRatio: number } } }).__artifice.info());
  expect(info.scale).toBe(3);
  expect(info.visibleWidth).toBe(359);
  expect(info.visibleHeight).toBe(663);
  expect(info.devicePixelRatio).toBe(2.4375);
  await expect(page.getByTestId('debug-readout')).toContainText('×3');

  // What is drawn: the canvas holds 359 × 663 game px, shown at 3 physical px each, on whole physical pixels.
  const drawn = await page.locator('#game canvas').evaluate((c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio;
    return { width: c.width, height: c.height, physW: r.width * dpr, physH: r.height * dpr, physX: r.left * dpr, physY: r.top * dpr };
  });
  expect(drawn.width).toBe(info.visibleWidth);
  expect(drawn.height).toBe(info.visibleHeight);
  // Chrome lays out in steps of 1/64 CSS px, so sizes land within one step (dpr ÷ 64 physical px) of exact.
  const step = info.devicePixelRatio / 64;
  const near = (got: number, want: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(step);
  near(drawn.physW, info.visibleWidth * 3);
  near(drawn.physH, info.visibleHeight * 3);
  near(drawn.physX, Math.round(drawn.physX));
  near(drawn.physY, Math.round(drawn.physY));
  await expect(page.getByRole('button', { name: 'Forge a knife' })).toBeInViewport({ ratio: 1 });

  const shot = testInfo.outputPath('open.png');
  await page.screenshot({ path: shot });
  await testInfo.attach('open', { path: shot, contentType: 'image/png' });

  // Choosing an item and tapping the forge button opens the forge for that item.
  await page.getByTestId('item-row').filter({ hasText: 'Sword' }).tap();
  await page.getByRole('button', { name: 'Forge a sword' }).tap();
  await expect(page.getByRole('button', { name: 'Hold: bellows' })).toBeVisible();
  await expect(page.locator('.top')).toContainText('Sword');
  expect(await page.evaluate(() => (window as unknown as { __artifice: { state(): { itemId: string } | null } }).__artifice.state()?.itemId)).toBe('sword');
});

test('has no debug API without ?debug', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('item-row')).toHaveCount(3);
  expect(await page.evaluate(() => '__artifice' in window)).toBe(false);
  await expect(page.getByTestId('debug-readout')).toHaveCount(0);
});
