export function mountRange(input){
 const range=document.createElement('input');range.type='range';range.id=input.id+'-range';range.className='value-range';range.min=input.min;range.max=input.max;range.step=input.step||'1';
 const label=document.querySelector(`label[for="${input.id}"]`)||input.closest('label')?.querySelector('span');if(label){label.id||=input.id+'-caption';range.setAttribute('aria-labelledby',label.id);}
 input.before(range);const sync=()=>{range.value=input.value;range.disabled=input.disabled;};
 for(const type of ['input','change']){range.addEventListener(type,event=>{event.stopPropagation();input.value=range.value;input.dispatchEvent(new Event(type,{bubbles:true}));});input.addEventListener(type,sync);}
 new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled','value']});sync();return {range,sync};
}
