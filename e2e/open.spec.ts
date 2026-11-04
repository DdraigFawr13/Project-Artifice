import { expect, test } from '@playwright/test';

// J1 Open the game (docs/specs/forge-prototype.md).
test('opens to the item list at ×4 on the Pixel size', async ({ page }, testInfo) => {
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

  const info = await page.evaluate(() => (window as unknown as { __artifice: { info(): Record<string, number> } }).__artifice.info());
  expect(info.scale).toBe(4);
  expect(info.visibleWidth).toBeGreaterThanOrEqual(336);
  expect(info.visibleWidth).toBeLessThanOrEqual(337);
  expect(info.devicePixelRatio).toBe(3.25);
  await expect(page.getByTestId('debug-readout')).toContainText('×4');

  const shot = testInfo.outputPath('open.png');
  await page.screenshot({ path: shot });
  await testInfo.attach('open', { path: shot, contentType: 'image/png' });

  // Choosing an item and tapping the forge button opens the placeholder, and Back returns.
  await page.getByTestId('item-row').filter({ hasText: 'Sword' }).tap();
  await page.getByRole('button', { name: 'Forge a sword' }).tap();
  await expect(page.getByText('Forge coming next')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(rows).toHaveCount(3);
});

test('has no debug API without ?debug', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('item-row')).toHaveCount(3);
  expect(await page.evaluate(() => '__artifice' in window)).toBe(false);
  await expect(page.getByTestId('debug-readout')).toHaveCount(0);
});
