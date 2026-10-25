import {test,expect} from '@playwright/test';
import {chooseTask} from './task-helpers.js';

for(const width of [390,1440,1920])test(`draw input cards keep readable inset at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.goto('/draw.html');
  for(const [task,field] of [['list','#draw-input'],['numbers','#draw-min']]){
    await chooseTask(page,'draw',task);
    const inset=await page.locator(field).evaluate(input=>{
      const card=input.closest('.tool-card'),box=card.getBoundingClientRect(),heading=card.querySelector('h2').getBoundingClientRect(),control=input.getBoundingClientRect();
      return {titleLeft:heading.left-box.left,titleTop:heading.top-box.top,inputLeft:control.left-box.left,inputRight:box.right-control.right};
    });
    for(const [edge,gap] of Object.entries(inset))expect(gap,`${task} ${edge}`).toBeGreaterThanOrEqual(16);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await chooseTask(page,'draw','list');await page.locator('#draw-input').fill('Alice\nBob\nCharlie');await page.locator('#draw-count').fill('3');await page.locator('#draw-run').click();
  expect((await page.locator('#draw-result').innerText()).split('\n').sort()).toEqual(['Alice','Bob','Charlie']);
  await chooseTask(page,'draw','numbers');await page.locator('#draw-min').fill('7');await page.locator('#draw-max').fill('7');await page.locator('#draw-number-run').click();await expect(page.locator('#draw-result')).toHaveText('7');
  await chooseTask(page,'draw','list');await expect(page.locator('#draw-input')).toHaveValue('Alice\nBob\nCharlie');await expect(page.locator('#draw-copy')).toBeEnabled();
});
