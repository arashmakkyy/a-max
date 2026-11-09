/* Minimal ZIP writer with CRC32, UTF-8 filenames, STORE compression method, no eval or dependencies. MIT. */
(function(global){'use strict';
const enc=new TextEncoder();const table=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let n=0;n<8;n++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[i]=c>>>0;}
function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
class ZIPStore {
 constructor(){this.entries=[];}
 file(name,data){this.entries.push({name:String(name),data});return this;}
 async generateAsync({type='blob'}={}){
   const entries=[];for(const entry of this.entries){const bytes=typeof entry.data==='string'?enc.encode(entry.data):entry.data instanceof Blob?new Uint8Array(await entry.data.arrayBuffer()):new Uint8Array(entry.data);const name=enc.encode(entry.name);entries.push({bytes,name,crc:crc32(bytes)});}
   const parts=[],central=[];let offset=0,centralLength=0;
   const append=(a)=>{const data=new Uint8Array(a);parts.push(data);offset+=data.length;};
   for(const e of entries){const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(e.crc),...u32(e.bytes.length),...u32(e.bytes.length),...u16(e.name.length),...u16(0)]);
     const center=new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(e.crc),...u32(e.bytes.length),...u32(e.bytes.length),...u16(e.name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
     central.push(center,e.name);centralLength+=center.length+e.name.length;
     append(local);append(e.name);append(e.bytes);
   }
   const centralStart=offset;for(const c of central)append(c);
   append([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(centralLength),...u32(centralStart),...u16(0)]);
   const blob=new Blob(parts,{type:'application/zip'});
   if(type==='blob')return blob; if(type==='uint8array')return new Uint8Array(await blob.arrayBuffer());
   throw Error('Unsupported ZIP output type');
 }
}
global.JSZip=ZIPStore;
})(typeof globalThis!=='undefined'?globalThis:self);
