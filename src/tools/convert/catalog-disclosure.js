export const catalogDisclosureKey='listools-convert-categories-v1';

export function createCatalogDisclosure(categoryIds,storage){
 const ids=new Set(categoryIds),open={};
 try{
  storage??=globalThis.localStorage;
  const saved=JSON.parse(storage?.getItem(catalogDisclosureKey)||'null');
  if(saved?.version===1)for(const id of ids)if(typeof saved.open?.[id]==='boolean')open[id]=saved.open[id];
 }catch{}
 return {
  isOpen:id=>open[id]!==false,
  setOpen(id,value){
   if(!ids.has(id))return;
   open[id]=Boolean(value);
   try{storage?.setItem(catalogDisclosureKey,JSON.stringify({version:1,open}));}catch{}
  }
 };
}
