import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { buildFeedbackUrl, feedbackTool } from '../src/tools/shared/feedback.js';

const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
test('feedback opens the configured Issue Form with only registered public metadata',()=>{
  const url=new URL(buildFeedbackUrl({issuesUrl:pkg.bugs.url,tool:'speedtest',version:pkg.version,locale:'zh-Hans',body:'FEEDBACK_SECRET_INPUT',file:'FEEDBACK_SECRET_FILE'}));
  assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/Souvenirser/LisTools/issues/new');
  assert.deepEqual(Object.fromEntries(url.searchParams),{template:'feedback.yml',title:'[LisTools] 网速测试 - ',tool:'网速测试 (speedtest)',version:pkg.version,locale:'zh-Hans'});
  assert.ok(!url.href.includes('FEEDBACK_SECRET'));
});
test('tool context resolves registered conversion routes without forwarding raw URL contents',()=>{
  for(const [path,hash,want] of [['/index.html','','json'],['/convert.html','#base64url','base64url'],['/convert.html','#md5','md5'],['/convert.html','#FEEDBACK_SECRET','base64'],['/popup.html','','toolbox'],['/FEEDBACK_SECRET.html','#secret','toolbox']])assert.equal(feedbackTool(path,hash),want);
  const url=new URL(buildFeedbackUrl({issuesUrl:pkg.bugs.url,tool:'FEEDBACK_SECRET',version:pkg.version,locale:'FEEDBACK_SECRET'}));
  assert.equal(url.searchParams.get('tool'),'Toolbox (toolbox)');assert.equal(url.searchParams.get('locale'),'en');
  assert.ok(!url.href.includes('FEEDBACK_SECRET'));
});
test('link prefills match editable text fields in the GitHub form',()=>{
  const form=parse(readFileSync(new URL('../.github/ISSUE_TEMPLATE/feedback.yml',import.meta.url),'utf8'));
  const fields=new Map(form.body.filter(field=>field.id).map(field=>[field.id,field]));
  for(const id of ['tool','version','locale'])assert.equal(fields.get(id)?.type,'input');
  assert.equal(fields.get('category')?.validations.required,true);
  assert.equal(fields.get('description')?.validations.required,true);
  for(const id of ['reproduction','expected','environment','attachments'])assert.ok(fields.has(id));
});
test('task addresses retain their parent tool in public feedback metadata',()=>{
 for(const [tool,task] of [['qr','recognize'],['text','extract'],['pdf','rotate'],['dates','workdays'],['images','crop'],['draw','numbers'],['timer','stopwatch']])assert.equal(feedbackTool('/'+tool+'.html','#'+task),tool);
});
