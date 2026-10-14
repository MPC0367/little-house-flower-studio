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

/* Reference photos are stored without what the camera wrote about them: location (GPS), camera,
   dates, comments and thumbnails. The pixels are never re-encoded (no image library runs here); the
   metadata sections are dropped from the file itself, and a file that does not end properly is
   refused rather than stored half-read. */
const CRC=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=(bytes,start,end)=>{let c=0xffffffff;for(let i=start;i<end;i++)c=CRC[(c^bytes[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const join=parts=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};
const broken=()=>authError('This image file is damaged or incomplete. Please choose another photo.');

function cleanJPEG(bytes){
  const parts=[bytes.subarray(0,2)];let offset=2,sawFrame=false;
  while(offset<bytes.length){
    if(bytes[offset]!==0xff)throw broken();
    let at=offset+1;while(bytes[at]===0xff)at++;
    const marker=bytes[at];if(marker===undefined)throw broken();
    if(marker===0xd9)throw broken();                      // an end before any picture data
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){parts.push(bytes.subarray(offset,at+1));offset=at+1;continue;}
    if(at+2>=bytes.length)throw broken();
    const length=(bytes[at+1]<<8)|bytes[at+2],end=at+1+length;
    if(length<2||end>bytes.length)throw broken();
    if(marker===0xda){                                    // start of scan: the rest is picture data and must end with EOI
      if(!sawFrame)throw broken();
      let last=bytes.length;while(last>end&&bytes[last-1]===0)last--;   // tolerate zero padding after the end marker
      if(last-end<2||bytes[last-2]!==0xff||bytes[last-1]!==0xd9)throw broken();
      parts.push(bytes.subarray(offset,last));return join(parts);
    }
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))sawFrame=true;
    // APP1 (EXIF, XMP), APP12/APP13 (Photoshop, IPTC) and comments go; everything else, colour profiles included, stays
    if(![0xe1,0xec,0xed,0xfe].includes(marker))parts.push(bytes.subarray(offset,end));
    offset=end;
  }
  throw broken();
}
function cleanPNG(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts=[bytes.subarray(0,8)];let offset=8;
  while(offset+12<=bytes.length){
    const length=view.getUint32(offset),end=offset+12+length;
    if(end>bytes.length)throw broken();
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if(crc32(bytes,offset+4,offset+8+length)!==view.getUint32(offset+8+length))throw broken();
    if(!['eXIf','tEXt','zTXt','iTXt','tIME'].includes(type))parts.push(bytes.subarray(offset,end));
    offset=end;
    if(type==='IEND')return join(parts);
  }
  throw broken();
}
function cleanWebP(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(4,true)+8>bytes.length)throw broken();
  const end=view.getUint32(4,true)+8,parts=[];let offset=12,vp8x=null;
  while(offset+8<=end){
    const type=String.fromCharCode(...bytes.subarray(offset,offset+4)),size=view.getUint32(offset+4,true),next=offset+8+size+(size&1);
    if(offset+8+size>end)throw broken();
    if(type!=='EXIF'&&type!=='XMP '){const chunk=bytes.slice(offset,Math.min(next,end));if(type==='VP8X')vp8x=chunk;parts.push(chunk);}
    offset=next;
  }
  if(!parts.some(p=>['VP8 ','VP8L','ANMF'].includes(String.fromCharCode(...p.subarray(0,4)))))throw broken();
  if(vp8x)vp8x[8]&=~(0x08|0x04);                          // the header no longer announces EXIF or XMP
  const body=join(parts),head=new Uint8Array(12);head.set(bytes.subarray(0,12));
  new DataView(head.buffer).setUint32(4,body.length+4,true);
  return join([head,body]);
}
/** the same picture without its metadata; refuses damaged files */
export function cleanImage(bytes){
  const {mime}=imageMetadata(bytes);
  const clean=mime==='image/jpeg'?cleanJPEG(bytes):mime==='image/png'?cleanPNG(bytes):cleanWebP(bytes);
  return {bytes:clean,...imageMetadata(clean)};
}
