import{test,expect}from'@playwright/test';

test('tool menu uses decorative SVG icons without losing text or current-tool semantics',async({page})=>{
 await page.goto('/qr.html');await page.locator('button.brand').click();
 await expect(page.locator('#tool-menu nav>details')).toHaveCount(4);
 await expect(page.locator('#tool-menu nav>details[open]')).toHaveCount(0);
 await expect(page.locator('#tool-menu nav .tool-menu-icon svg')).toHaveCount(23);
 const files=page.locator('#tool-menu details[data-group-id="files"]');await files.locator('summary').click();
 await expect(files.locator('a[aria-current="page"]')).toHaveCount(1);await expect(files.locator('a[aria-current="page"]')).toHaveAttribute('data-target','qr.html');
 await expect(files.locator('a[aria-current="page"] .tool-menu-name')).not.toBeEmpty();
 await expect(files.locator('a[aria-current="page"] svg')).toHaveAttribute('aria-hidden','true');
 await page.locator('#tool-menu-search').fill('MD5');await expect(page.locator('#tool-menu a[data-target="convert.html#md5"]')).toHaveCount(1);
});
