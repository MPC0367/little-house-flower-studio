import {authError} from './hosted-crypto.mjs';
export function imageMetadata(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),ascii=(offset,length)=>String.fromCharCode(...bytes.slice(offset,offset+length));
  let width=0,height=0,mime='';
  if(bytes.length>=33&&bytes[0]===137&&ascii(1,7)==='PNG\r\n\x1a\n'&&ascii(12,4)==='IHDR'){width=view.getUint32(16);height=view.getUint32(20);mime='image/png';}
  else if(bytes.length>30&&ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){
    const kind=ascii(12,4);mime='image/webp';
    if(kind==='VP8X'){width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(kind==='VP8L'&&bytes[20]===47){const bits=view.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}
    else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
  }else if(bytes.length>4&&bytes[0]===255&&bytes[1]===216){
    mime='image/jpeg';let offset=2;
    while(offset+4<bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;
    }
  }
  if(!mime||width<1||height<1||width*height>25000000)throw authError('Use a valid JPEG, PNG or WebP image under 25 megapixels.');
  return {mime,width,height};
}
