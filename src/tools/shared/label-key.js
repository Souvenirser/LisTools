export function textKey(text){let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return 'uiText.s'+(hash>>>0).toString(16);}
