export function retryDelay(attempt,retryAfter,random=Math.random,at=Date.now()){
 const explicit=retryAfter==null?0:/^\d+(\.\d+)?$/.test(String(retryAfter))?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-at);
 return Math.min(300000,Math.max(Number.isFinite(explicit)?explicit:0,1000*2**Math.min(attempt,8))+Math.floor(random()*300));
}
