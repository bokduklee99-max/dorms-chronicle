// Public CSV reads in the local lesson viewer share one copy per browser origin.
const cacheName='chronicle-public-lesson-csv-v1';
export const localLesson=['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname);
const pending=new Map();

/** @type {typeof fetch} */
export async function readLessonSheet(input,options){
 if(!localLesson||!globalThis.caches)return fetch(input,options);
 const key=new URL(input instanceof Request?input.url:String(input));
 key.searchParams.delete('v');
 const url=key.href;
 if(!pending.has(url)){
  const read=(async()=>{
   const cache=await caches.open(cacheName).catch(()=>null);
   const saved=await cache?.match(url);
   if(saved)return saved;
   const response=await fetch(input,options);
   if(cache&&response.ok&&!response.headers.get('content-type')?.includes('text/html')){
    await cache.put(url,response.clone()).catch(()=>{});
   }
   return response;
  })();
  pending.set(url,read.finally(()=>pending.delete(url)));
 }
 return (await pending.get(url)).clone();
}

export async function refreshLocalLessonSheets(){
 const cache=await caches.open(cacheName);
 const keys=await cache.keys();
 // addAll replaces the batch only after every public sheet request succeeds.
 await cache.addAll(keys.map(key=>new Request(key.url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)})));
}
