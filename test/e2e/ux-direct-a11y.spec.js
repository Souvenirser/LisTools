import {test,expect} from '@playwright/test';

for(const {file,selector,name,compare} of [
  {file:'index.html',selector:'.toolbar',name:'Tools'},
  {file:'diff.html',selector:'.toolbar',name:'Tools'},
  {file:'diff.html',selector:'.diff-navigation',name:'Difference navigation',compare:true}
])test(`${file} ${selector} exposes a named accessible group`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
  await page.goto('/'+file);
  if(compare){
    await page.locator('#left-source .cm-content').fill('{"first":1,"last":2}');
    await page.locator('#right-source .cm-content').fill('{"first":3,"last":4}');
    await page.locator('#compare').click();
    await expect(page.locator('body')).toHaveAttribute('data-status','ready');
  }
  const group=page.locator(selector);
  await expect(group).toBeVisible();
  await expect(group).toHaveRole('group');
  await expect(group).toHaveAccessibleName(name);
  const button=group.locator('button:enabled').first();
  await button.focus();await expect(button).toBeFocused();
});

test('JSON result tokens and line numbers retain readable contrast',async({page},testInfo)=>{
  await page.addInitScript(()=>localStorage.setItem('listools-language','en'));
  await page.goto('/index.html');
  await page.locator('#source').fill('{"number":12,"truth":true,"falsehood":false,"empty":null,"name":"LisTools"}');
  await page.locator('#format').click();await expect(page.locator('#copy')).toBeEnabled();
  const values=await page.locator('#editor .cm-content span, #editor .cm-gutters .cm-gutterElement').evaluateAll(nodes=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const context=canvas.getContext('2d');
    const parse=color=>{context.clearRect(0,0,1,1);context.fillStyle=color;context.fillRect(0,0,1,1);const [r,g,b,a]=context.getImageData(0,0,1,1).data;return[r,g,b,a/255];};
    const over=(fg,bg)=>fg.slice(0,3).map((value,index)=>value*(fg[3]??1)+bg[index]*(1-(fg[3]??1)));
    const luminance=rgb=>rgb.map(value=>value/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    return nodes.filter(node=>node.textContent.trim()&&node.checkVisibility()).map(node=>{
      const parents=[];for(let item=node;item;item=item.parentElement)parents.push(item);
      const bg=parents.reverse().reduce((color,item)=>over(parse(getComputedStyle(item).backgroundColor),color),[255,255,255]);
      const foreground=over(parse(getComputedStyle(node).color),bg),light=[luminance(foreground),luminance(bg)].sort((a,b)=>b-a);
      return{text:node.textContent,color:getComputedStyle(node).color,ratio:(light[0]+.05)/(light[1]+.05),lineNumber:node.classList.contains('cm-gutterElement')};
    });
  });
  await testInfo.attach('JSON token contrast',{body:JSON.stringify(values,null,2),contentType:'application/json'});
  for(const text of ['12','true','false','null','"LisTools"'])expect(values.some(value=>value.text===text)).toBe(true);
  expect(values.some(value=>value.lineNumber)).toBe(true);
  for(const value of values)expect(value.ratio,`${value.lineNumber?'line number':'JSON token'} ${value.text}`).toBeGreaterThanOrEqual(4.5);
});
