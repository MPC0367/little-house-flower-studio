import {authError,hash} from './hosted-crypto.mjs';

export const MAX_SITE_ASSET_BYTES=5*1024*1024;

/** Only bytes named by the build's immutable manifest can reach this R2 prefix. */
export async function uploadHostedSiteAsset(request,{env,digest,manifest}){
  if(!/^[a-f0-9]{64}$/.test(digest||''))throw authError('Approved site asset not found',404);
  const metadata=Object.values(manifest).find(asset=>asset.hash===digest);
  if(!metadata||!Number.isSafeInteger(metadata.size)||metadata.size<0||metadata.size>MAX_SITE_ASSET_BYTES||typeof metadata.mime!=='string'||/[\r\n]/.test(metadata.mime))throw authError('Approved site asset not found',404);
  const rawLength=request.headers.get('content-length'),declared=rawLength===null?null:Number(rawLength);
  if(declared!==null&&(!Number.isSafeInteger(declared)||declared<0||declared>MAX_SITE_ASSET_BYTES))throw authError('Payload too large',413);
  if(declared!==null&&declared!==metadata.size)throw authError('Site asset size does not match the manifest',422);
  if(request.headers.get('content-encoding')&&!['identity'].includes(request.headers.get('content-encoding')))throw authError('Compressed site asset uploads are unsupported',415);
  const reader=request.body?.getReader(),chunks=[];let length=0;
  if(reader)try{
    for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>MAX_SITE_ASSET_BYTES||length>metadata.size){await reader.cancel();throw authError('Site asset size does not match the manifest',413);}chunks.push(part.value);}
  }finally{reader.releaseLock();}
  if(length!==metadata.size)throw authError('Site asset size does not match the manifest',422);
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(hash(bytes)!==digest)throw authError('Site asset content does not match the manifest',422);
  if(!env.BUCKET?.put)throw authError('Site asset storage is unavailable',503);
  await env.BUCKET.put('site-assets/'+digest,bytes,{httpMetadata:{contentType:metadata.mime}});
  return {ok:true,hash:digest,size:length};
}
