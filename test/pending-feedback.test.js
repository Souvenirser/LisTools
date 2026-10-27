import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPendingFeedback} from '../src/tools/shared/pending-feedback.js';
for(const duration of [50,150,199,201,400])test(`visual feedback for ${duration}ms task`,t=>{
 t.mock.timers.enable({apis:['setTimeout']});const changes=[];const update=createPendingFeedback(wait=>changes.push(wait));
 update(true);t.mock.timers.tick(duration);assert.deepEqual(changes,duration<200?[true]:[true,false]);update(false);t.mock.timers.tick(1000);assert.equal(changes.at(-1),false);
});
test('cancelled or replaced feedback cannot reveal a new task early',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const changes=[];const update=createPendingFeedback(wait=>changes.push(wait));
 update(true);t.mock.timers.tick(150);update(false);update(true);t.mock.timers.tick(50);assert.equal(changes.at(-1),true);t.mock.timers.tick(150);assert.equal(changes.at(-1),false);
});
