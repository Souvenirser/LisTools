// The SDK's parallel latency engine does not inherit its bandwidth timeout.
// Guard fetch only for the lifetime of a test on the dedicated speed-test page.
export function createSpeedRequestGuard(fetchImpl,{timeoutMs=15000}={}) {
  const active=new Set();let closed=false;
  async function guardedFetch(input,init={}) {
    if(closed) throw new DOMException('Speed test ended','AbortError');
    const url=new URL(typeof input==='string'?input:input.url);
    const method=(init.method || input.method || 'GET').toUpperCase();
    if(url.origin!=='https://speed.cloudflare.com' || !((url.pathname==='/__down' && method==='GET') || (url.pathname==='/__up' && method==='POST'))) throw new TypeError('Speed test endpoint is not allowed');
    const controller=new AbortController();
    const cancel=()=>controller.abort(init.signal.reason);
    const entry={controller,cleanup:()=>{clearTimeout(timer);init.signal?.removeEventListener('abort',cancel);active.delete(entry);}};
    const timer=setTimeout(()=>controller.abort(new DOMException('Speed request exceeded 15 seconds','TimeoutError')),timeoutMs);
    active.add(entry);controller.signal.addEventListener('abort',entry.cleanup,{once:true});
    if(init.signal?.aborted) cancel();else init.signal?.addEventListener('abort',cancel,{once:true});
    try {
      const headers=new Headers(init.headers);headers.delete('authorization');headers.delete('cookie');
      const response=await fetchImpl(url.href,{...init,method,headers,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
      if(!response.ok) {controller.abort();entry.cleanup();return response;}
      // The pinned SDK consumes measurements with Response.text(). Keep the
      // deadline active through body consumption, not merely response headers.
      const readText=response.text.bind(response);
      response.text=async()=>{try{return await readText();}finally{entry.cleanup();}};
      return response;
    } catch(error) {entry.cleanup();throw error;}
  }
  return {fetch:guardedFetch,dispose(){closed=true;for(const entry of active){entry.controller.abort();entry.cleanup();}}};
}
