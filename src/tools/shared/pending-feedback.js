// Delay only the visual notice; controller state, cancellation and exports stay immediate.
export function createPendingFeedback(present){
 let timer,version=0;
 return pending=>{
  const current=++version;clearTimeout(timer);present(Boolean(pending));
  if(pending)timer=setTimeout(()=>{if(current===version)present(false);},200);
 };
}
export function pendingFeedback(...ids){
 const update=createPendingFeedback(wait=>{for(const id of ids){const node=document.getElementById(id);if(node)node.toggleAttribute('data-feedback-wait',wait);}});
 addEventListener('pagehide',()=>update(false));return update;
}
