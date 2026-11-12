const encoder=new TextEncoder();
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0};
/** Small UTF-8, uncompressed ZIP; filenames are generated, never taken from uploads. */
export function zipStored(files){
 const local=[],central=[];let offset=0;
 for(const [path,value] of Object.entries(files)){
  if(!/^[A-Za-z0-9_./-]+$/.test(path)||path.startsWith('/')||path.split('/').includes('..'))throw Error('ZIP路径无效');
  const name=encoder.encode(path),bytes=typeof value==='string'?encoder.encode(value):value,crc=crc32(bytes),header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,crc,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);header.set(name,30);local.push(header,bytes);
  const record=new Uint8Array(46+name.length),v=new DataView(record.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,bytes.length,true);v.setUint32(24,bytes.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=header.length+bytes.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+22);let p=0;for(const b of [...local,...central,end]){result.set(b,p);p+=b.length;}return result;
}
