import { expect, test } from '@playwright/test';
import { signIn, USERS } from './helpers';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kH8AAAAASUVORK5CYII=', 'base64');

for (const [role, email] of Object.entries({ learner: USERS.student, trainer: USERS.teacher, coordinator: USERS.admin })) {
  test(`${role} can upload, replace and remove their profile picture`, async ({ page }) => {
    await signIn(page, email);
    await page.goto('/settings');
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('status').filter({ hasText: 'Profile picture updated' })).toBeVisible();
    const photo = page.locator('.settings-hero img.profile-avatar');
    await expect(photo).toBeVisible();
    await expect(photo).toHaveJSProperty('naturalWidth', 1);
    const first = await photo.getAttribute('src');
    await expect(input).toBeEnabled();
    await input.setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
    await expect(photo).not.toHaveAttribute('src', first!);
    await page.reload();
    await expect(photo).toBeVisible();
    await page.getByRole('button', { name: 'Remove picture' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Profile picture removed' })).toBeVisible();
    await expect(photo).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Remove picture' })).toHaveCount(0);
  });
}
