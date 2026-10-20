import test from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, restoreTimer, formatTime } from '../src/tools/timer/core.js';
test('countdown uses deadline and expiration occurs once across delayed ticks',()=>{
 let now=1000; const timer=createTimer('countdown',()=>now);timer.reset(5000);timer.start();now=3500;assert.equal(timer.read().value,2500);timer.pause();now=9000;assert.equal(timer.read().value,2500);timer.start();now=20000;assert.equal(timer.read().expired,true);assert.equal(timer.read().expired,false);assert.equal(timer.read().value,0);
});
test('stopwatch pause resume laps and restore use elapsed time',()=>{
 let now=100;const timer=createTimer('stopwatch',()=>now);timer.start();now=1100;assert.equal(timer.lap(),1000);timer.pause();now=5000;assert.equal(timer.read().value,1000);timer.start();now=6000;const restored=restoreTimer(timer.serialize(),()=>now);assert.equal(restored.read().value,2000);assert.deepEqual(restored.laps,[1000]);
});
test('persisted state is numeric only and corrupt state falls back',()=>{
 assert.equal(restoreTimer('{"evil":"text"}').mode,'countdown');assert.equal(formatTime(3661002),'01:01:01.002');
 assert.throws(()=>createTimer().reset(-1),{code:'timer.invalidDuration'});
});
test('expired countdown restores once after reload and reset clears laps',()=>{
 let now=100;const timer=createTimer('countdown',()=>now);timer.reset(1000);timer.start();now=2000;const restored=restoreTimer(timer.serialize(),()=>now);assert.equal(restored.read().expired,true);assert.equal(restored.read().expired,false);const restoredAgain=restoreTimer(restored.serialize(),()=>now);assert.equal(restoredAgain.read().expired,false);
 const stopwatch=createTimer('stopwatch',()=>now);stopwatch.start();now+=1000;stopwatch.lap();stopwatch.reset();assert.deepEqual(stopwatch.laps,[]);assert.equal(stopwatch.read().value,0);
});
