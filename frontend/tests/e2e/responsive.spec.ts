import { expect, test } from '@playwright/test';
import { signIn, USERS } from './helpers';

for (const [role, email] of Object.entries({ learner: USERS.student, trainer: USERS.teacher, coordinator: USERS.admin })) {
test(`${role} mobile navigation expands and closes without horizontal scrolling`, async ({ page }) => {
  await signIn(page, email);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  if (role === 'coordinator') {
    const attention = await page.getByRole('region', { name: 'Needs attention', exact: true }).boundingBox();
    const activity = await page.getByRole('region', { name: 'Recent activity', exact: true }).boundingBox();
    expect(attention).not.toBeNull();
    expect(activity).not.toBeNull();
    expect(Math.abs(attention!.width - activity!.width)).toBeLessThan(2);
  }

  await page.getByRole('button', { name: 'Expand navigation' }).click();
  const drawer = page.getByRole('navigation', { name: 'Main', exact: true });
  await expect(drawer).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('navigation-expanded.png'), fullPage: true });
  await drawer.getByRole('link', { name: 'Calendar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  await expect(drawer).toBeHidden();
});
}

test('keyboard users can skip to the main content', async ({ page }) => {
  await signIn(page, USERS.student);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Amina/ })).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('display settings enlarge text and persist', async ({ page }) => {
  await signIn(page, USERS.student);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Display', exact: true }).click();
  await page.getByRole('radio', { name: 'Larger', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('125%');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Display', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe('125%');
});
