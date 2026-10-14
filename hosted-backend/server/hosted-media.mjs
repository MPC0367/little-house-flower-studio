/** Keep supplied MP4s seekable even when an asset binding returns the full file. */
export async function mediaRange(request,response){
 if(request.method!=='GET'||response.status!==200||!new URL(request.url).pathname.endsWith('.mp4'))return response;
 const value=request.headers.get('range');if(!value)return response;
 const ifRange=request.headers.get('if-range');
 if(ifRange&&ifRange!==response.headers.get('etag')&&ifRange!==response.headers.get('last-modified'))return response;
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);if(!match||(!match[1]&&!match[2]))return response;
 const bytes=await response.arrayBuffer(),total=bytes.byteLength,headers=new Headers(response.headers);
 headers.delete('content-encoding');headers.set('Accept-Ranges','bytes');
 let start=match[1]?Number(match[1]):Math.max(0,total-Number(match[2]));
 let end=match[1]?(match[2]?Math.min(total-1,Number(match[2])):total-1):total-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=total||end<start){headers.set('Content-Range',`bytes */${total}`);headers.set('Content-Length','0');return new Response(null,{status:416,headers});}
 headers.set('Content-Range',`bytes ${start}-${end}/${total}`);headers.set('Content-Length',String(end-start+1));
 return new Response(bytes.slice(start,end+1),{status:206,headers});
}
