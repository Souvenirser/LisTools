// Deterministic form work only; each page owns invalidation and result/error handling.
export function bindAutoRun(root,run,{canRun=()=>true,delay=350,button,cancelButton}={}){
 let timer,composing=false;
 const cancel=()=>clearTimeout(timer);
 function schedule(){cancel();if(composing||!canRun())return;timer=setTimeout(()=>{if(!composing&&canRun())run();},delay);}
 root.addEventListener('input',schedule);root.addEventListener('change',schedule);
 root.addEventListener('compositionstart',()=>{composing=true;cancel();});root.addEventListener('compositionend',()=>{composing=false;schedule();});
 button?.addEventListener('click',cancel);cancelButton?.addEventListener('click',cancel);globalThis.addEventListener?.('pagehide',cancel);
 return {schedule,cancel};
}
