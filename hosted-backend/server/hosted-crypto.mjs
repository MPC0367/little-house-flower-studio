// Synchronous SHA-256 for the inherited synchronous booking/configuration contracts.
// Authentication uses Web Crypto's native PBKDF2 below; this hash is not a password KDF.
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotate=(x,n)=>(x>>>n)|(x<<(32-n));
export const hex=bytes=>Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
export const unhex=value=>Uint8Array.from(value.match(/../g)||[],pair=>parseInt(pair,16));
export function hash(value) {
  const bytes=value instanceof Uint8Array?value:new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
  const length=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(length),view=new DataView(padded.buffer);
  padded.set(bytes);padded[bytes.length]=128;view.setUint32(length-8,Math.floor(bytes.length/0x20000000));view.setUint32(length-4,(bytes.length*8)>>>0);
  const state=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64);
  for(let offset=0;offset<length;offset+=64){
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,h]=state;
    for(let i=0;i<64;i++){const t1=(h+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0,t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>{state[i]=(state[i]+v)>>>0;});
  }
  return Array.from(state,n=>n.toString(16).padStart(8,'0')).join('');
}
export const randomHex=(length=32)=>hex(crypto.getRandomValues(new Uint8Array(length)));
export function constantEqual(a,b){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];return difference===0;}
export function authError(message,status=422){return Object.assign(new Error(message),{status});}
export function validatePassword(password){if(typeof password!=='string'||[...password].length<12||[...password].length>128)throw authError('Use a password with 12 to 128 characters.');}
const ITERATIONS=100000;
let active=0;
async function derive(password,salt){if(active>=2)throw authError('Sign-in is busy. Please try again shortly.',429);active++;try{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},key,256));}finally{active--;}}
export async function passwordRecord(password){validatePassword(password);const salt=crypto.getRandomValues(new Uint8Array(32));return {algorithm:'PBKDF2-SHA256',iterations:ITERATIONS,salt:hex(salt),hash:hex(await derive(password,salt)),authVersion:crypto.randomUUID(),updatedAt:new Date().toISOString()};}
export async function verifyPassword(password,record){
  if(typeof password!=='string'||[...password].length<12||[...password].length>128||record?.algorithm!=='PBKDF2-SHA256'||record.iterations!==ITERATIONS||!/^[a-f0-9]{64}$/.test(record.salt||'')||!/^[a-f0-9]{64}$/.test(record.hash||''))return false;
  return constantEqual(await derive(password,unhex(record.salt)),unhex(record.hash));
}
