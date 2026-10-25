import {test,expect} from '@playwright/test';
import {pages} from '../../src/tools/shared/navigation.js';

for(const width of [390,1440]){
  test(`framed workspaces keep headings inset at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    for(const {file,id} of pages){
      await page.goto('/'+file);await expect(page.locator('h1')).toBeVisible();
      const headings=await page.locator('main .tool-card,main .panel,main .workspace-input').evaluateAll(cards=>cards.filter(card=>card.checkVisibility()&&parseFloat(getComputedStyle(card).borderLeftWidth)>0).flatMap(card=>{
        const heading=[...card.querySelectorAll('h2')].find(node=>node.checkVisibility()&&node.closest('.tool-card,.panel,.workspace-input')===card);if(!heading)return[];
        const range=document.createRange();range.selectNodeContents(heading);const box=card.getBoundingClientRect(),text=range.getBoundingClientRect();
        return[{text:heading.textContent,left:text.left-box.left,right:box.right-text.right,top:text.top-box.top}];
      }));
      for(const heading of headings){expect(heading.left,`${id} ${heading.text}`).toBeGreaterThanOrEqual(12);expect(heading.right,`${id} ${heading.text}`).toBeGreaterThanOrEqual(12);expect(heading.top,`${id} ${heading.text}`).toBeGreaterThanOrEqual(8);}
    }
  });
  test(`draw controls have separation from the list at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/draw.html');
    const gap=await page.locator('#draw-input').evaluate(input=>input.getBoundingClientRect().top-document.querySelector('#draw-mode').closest('.tool-fields').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(12);
  });
  test(`calculator expression has separation from the result at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/calculator.html');
    const resultGap=await page.locator('.calculator-display').evaluate(panel=>panel.getBoundingClientRect().top-document.querySelector('#expression').getBoundingClientRect().bottom);
    expect(resultGap).toBeGreaterThanOrEqual(8);
  });
}

test('mobile QR input and preview use consistent card insets',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/qr.html');
  const insets=await page.locator('.tool-grid>div>.tool-card:visible,#qr-output-panel').evaluateAll(cards=>cards.map(card=>parseFloat(getComputedStyle(card).paddingInlineStart)));
  expect(insets).toHaveLength(2);expect(insets[0]).toBeGreaterThanOrEqual(16);expect(Math.abs(insets[0]-insets[1])).toBeLessThanOrEqual(1);
});
