const invalid=()=>{throw Object.assign(new Error('timer.invalidDuration'),{code:'timer.invalidDuration'});};
export function createTimer(mode='countdown',now=Date.now,saved) {
 let duration=saved?.duration??300000,base=saved?.base??(mode==='countdown'?duration:0),anchor=saved?.anchor??0,running=Boolean(saved?.running),fired=Boolean(saved?.fired);
 const laps=[...(saved?.laps||[])];
 const value=()=>running?mode==='countdown'?Math.max(0,base-Math.max(0,now()-anchor)):base+Math.max(0,now()-anchor):base;
 const timer={mode,laps,
  read() {const current=value();let expired=false;if(mode==='countdown'&&running&&current===0){running=false;base=0;if(!fired){fired=true;expired=true;}}return {value:current,running,expired,duration,finished:fired};},
  start() {if(running||mode==='countdown'&&base===0)return;anchor=now();running=true;},
  pause() {const current=value();if(mode==='countdown'&&running&&current===0)return;base=current;running=false;},
  reset(next=duration) {if(!Number.isFinite(next)||next<0||next>365*86400000)invalid();duration=next;base=mode==='countdown'?next:0;running=false;anchor=0;fired=false;laps.length=0;},
  lap() {if(mode!=='stopwatch'||!running)return;const current=value();if(laps.length<10000)laps.push(current);return current;},
  serialize() {return JSON.stringify({mode:mode==='countdown'?0:1,duration,base,anchor,running:Number(running),fired:Number(fired),laps});}
 };
 return timer;
}
export function restoreTimer(serialized,now=Date.now) {
 try {
  const saved=JSON.parse(serialized),keys=['mode','duration','base','anchor','running','fired','laps'];
  if(!saved||Object.keys(saved).some(key=>!keys.includes(key))||![0,1].includes(saved.mode)||![0,1].includes(saved.running)||![0,1].includes(saved.fired)||!['duration','base','anchor'].every(key=>Number.isFinite(saved[key])&&saved[key]>=0)||saved.duration>365*86400000||!Array.isArray(saved.laps)||saved.laps.length>10000||!saved.laps.every(value=>Number.isFinite(value)&&value>=0))throw Error();
  return createTimer(saved.mode===0?'countdown':'stopwatch',now,saved);
 } catch {return createTimer('countdown',now);}
}
export function formatTime(value) {
 const total=Math.max(0,Math.floor(value));return `${String(Math.floor(total/3600000)).padStart(2,'0')}:${String(Math.floor(total/60000)%60).padStart(2,'0')}:${String(Math.floor(total/1000)%60).padStart(2,'0')}.${String(total%1000).padStart(3,'0')}`;
}
