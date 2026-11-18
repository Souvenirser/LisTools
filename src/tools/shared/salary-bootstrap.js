import {salaryKey,salaryEvent} from '../salary/key.js';
// Disabled tools only read the opt-in flag; date/money code stays lazy.
export function mountSalaryBootstrap(){
 let started=false;
 function activate(){if(started)return;let config;try{config=JSON.parse(localStorage.getItem(salaryKey)||'null');}catch{return;}if(config?.version!==1||config.enabled!==true||config.showBar!==true)return;started=true;void import('../salary/widget.js').then(module=>module.mountSalaryBar()).catch(()=>{started=false;});}
 addEventListener('storage',event=>{if(event.key===salaryKey||event.key===null)activate();});addEventListener(salaryEvent,activate);activate();
}
