import { test, expect } from '@playwright/test';

for(const scale of [1,2])test.describe(`speed samples at ${scale}x pixel density`,()=>{
  test.use({deviceScaleFactor:scale});
  test('canvas keeps native screen resolution when the viewport changes',async({page})=>{
    await page.goto('/speedtest.html');
    for(const width of [1360,640,1600]){
      await page.setViewportSize({width,height:960});
      await expect.poll(()=>page.locator('#speed-chart').evaluate(canvas=>{
        const bounds=canvas.getBoundingClientRect(),ratio=window.devicePixelRatio;
        return canvas.width===Math.round(bounds.width*ratio)&&canvas.height===Math.round(bounds.height*ratio);
      })).toBe(true);
    }
  });
});
