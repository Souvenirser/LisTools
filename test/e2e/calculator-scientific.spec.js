import {selectLanguage} from './language-helpers.js';
import { test, expect } from '@playwright/test';
import { colord, extend } from 'colord';
import a11y from 'colord/plugins/a11y';
extend([a11y]);

test('scientific mode preserves the expression and result while angle changes invalidate them',async({page})=>{
  await page.goto('/calculator.html');await selectLanguage(page,'en');
  await expect(page.locator('#calc-mode-standard')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#scientific-keypad')).toBeHidden();
  await page.locator('#expression').fill('200+10%');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('220');
  await page.locator('#calc-mode-scientific').click();await expect(page.locator('#scientific-keypad')).toBeVisible();
  await expect(page.locator('#result')).toHaveText('220');await expect(page.locator('#expression')).toHaveValue('200+10%');
  await page.locator('#expression').fill('sin(30)');await page.locator('#expression').press('Enter');await expect(page.locator('#result')).toHaveText('0.5');
  await page.locator('#angle-unit').selectOption('rad');await expect(page.locator('#result')).toBeEmpty();await expect(page.locator('#copy')).toBeDisabled();
  await page.locator('#expression').fill('sin(pi/2)');await page.locator('#calculate').click();await expect(page.locator('#result')).toHaveText('1');
  await selectLanguage(page,'ar');await expect(page.locator('#result')).toHaveText('1');await expect(page.locator('#angle-unit')).toHaveValue('rad');
  await page.locator('#calc-mode-standard').click();await expect(page.locator('#result')).toHaveText('1');
  await page.reload();await expect(page.locator('#angle-unit')).toHaveValue('deg');await expect(page.locator('#scientific-keypad')).toBeHidden();await expect(page.locator('#history li')).toHaveCount(0);
});

test('calculator keys respect selection caret sign and keyboard editing',async({page})=>{
  await page.goto('/calculator.html');await page.locator('#calc-mode-scientific').click();
  const input=page.locator('#expression');await input.fill('30');await input.selectText();await page.locator('[data-key="sin"]').click();await expect(input).toHaveValue('sin(30)');
  await input.press('=');await expect(page.locator('#result')).toHaveText('0.5');
  await input.fill('12+34');await input.evaluate(element=>element.setSelectionRange(3,5));await page.locator('[data-key="negate"]').click();await expect(input).toHaveValue('12+-(34)');
  await input.evaluate(element=>element.setSelectionRange(3,8));await page.locator('[data-key="backspace"]').click();await expect(input).toHaveValue('12+');
  await page.locator('[data-key="backspace"]').click();await expect(input).toHaveValue('12');
  await input.press('Escape');await expect(input).toBeEmpty();await page.locator('[data-key="negate"]').click();await expect(input).toHaveValue('-');
  await input.press('Escape');await page.locator('[data-key="combinations"]').click();await expect(input).toHaveValue('combinations(');await expect(page.locator('#argument-hint')).toContainText('combinations(5, 2)');
  await input.pressSequentially('5,2)');await input.press('Enter');await expect(page.locator('#result')).toHaveText('10');
  await input.fill('tan(90)');await input.press('Enter');await expect(page.locator('#tool-status')).toBeVisible();await expect(page.locator('#copy')).toBeDisabled();
  await input.fill('5!');await input.press('Enter');await expect(page.locator('#result')).toHaveText('120');
});

test('Ans history freezes its original full-precision value and angle context',async({page})=>{
  await page.goto('/calculator.html');const input=page.locator('#expression');
  await input.fill('Ans');await input.press('Enter');await expect(page.locator('#tool-status')).toBeVisible();
  await input.fill('0.1+0.2');await input.press('Enter');await expect(page.locator('#result')).toHaveText('0.3');
  await page.locator('#calc-mode-scientific').click();await page.locator('#angle-unit').selectOption('rad');await input.focus();await input.press('Escape');
  await page.locator('[data-key="ans"]').click();await input.pressSequentially('*10');await input.press('Enter');await expect(page.locator('#result')).toHaveText('3');
  await input.fill('9');await input.press('Enter');await expect(page.locator('#result')).toHaveText('9');
  await page.locator('#angle-unit').selectOption('deg');if(await page.locator('#calculator-history-toggle').getAttribute('aria-expanded')!=='true')await page.locator('#calculator-history-toggle').click();await page.locator('#history button').nth(1).click();await expect(input).toHaveValue('(0.3)*10');await expect(page.locator('#angle-unit')).toHaveValue('rad');
  await input.press('Enter');await expect(page.locator('#result')).toHaveText('3');
  await input.fill('2Ans');await input.press('Enter');await expect(page.locator('#result')).toHaveText('6');
  await input.fill('9');await input.press('Enter');await expect(page.locator('#result')).toHaveText('9');
  if(await page.locator('#calculator-history-toggle').getAttribute('aria-expanded')!=='true')await page.locator('#calculator-history-toggle').click();await page.locator('#history button').nth(1).click();await expect(input).toHaveValue('2(3)');await input.press('Enter');await expect(page.locator('#result')).toHaveText('6');
});

test('scientific colored keys stay usable in a narrow RTL layout',async({page})=>{
  await page.setViewportSize({width:320,height:900});await page.goto('/calculator.html');await page.locator('#calc-mode-scientific').click();await selectLanguage(page,'ar');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const overflow=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,elements:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,classes:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.left<-1||e.right>innerWidth+1).slice(0,12)}));
  expect(overflow.width,JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport+1);
  const colors=new Set();
  for(const key of ['7','sin','+','clear','equals']){
    const button=page.locator(`[data-key="${key}"]`);await expect(button).toBeVisible();
    const style=await button.evaluate(element=>{const s=getComputedStyle(element),r=element.getBoundingClientRect();return {background:s.backgroundColor,color:s.color,height:r.height,left:r.left,right:r.right};});
    expect(style.height).toBeGreaterThanOrEqual(44);expect(style.left).toBeGreaterThanOrEqual(0);expect(style.right).toBeLessThanOrEqual(321);
    expect(colord(style.background).contrast(style.color)).toBeGreaterThanOrEqual(4.5);colors.add(style.background);
  }
  expect(colors.size).toBe(5);await expect(page.locator('#expression')).toHaveAttribute('dir','ltr');
});
