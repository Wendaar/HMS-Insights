import {readFileSync} from 'node:fs';
import {brotliDecompressSync} from 'node:zlib';
import assert from 'node:assert/strict';
// WOFF2 stores cmap without a transform. Inspect its real glyph mapping using
// Node's Brotli decoder; no font-tool dependency or network request is needed.
export function fontTables(file){
 const b=readFileSync(file);assert.equal(b.toString('ascii',0,4),'wOF2');let cursor=48,offset=0;const entries=[];
 const base128=()=>{let n=0;for(let i=0;i<5;i++){const v=b[cursor++];n=n*128+(v&127);if(!(v&128))return n;}throw Error('Invalid WOFF2 length');};
 for(let i=0;i<b.readUInt16BE(12);i++){
  const flags=b[cursor++],index=flags&63,version=flags>>6;
  const tag=index===63?b.toString('ascii',cursor,cursor+=4):index===0?'cmap':index===6?'OS/2':index===47?'fvar':String(index);
  const length=base128(),transformed=index===10||index===11?version!==3:version!==0,stored=transformed?base128():length;
  entries.push({tag,offset,length:stored});offset+=stored;
 }
 const decoded=brotliDecompressSync(b.subarray(cursor,cursor+b.readUInt32BE(20)));
 return Object.fromEntries(entries.map(t=>[t.tag,decoded.subarray(t.offset,t.offset+t.length)]));
}
export function glyphFor(cmap,point){
 for(let i=0;i<cmap.readUInt16BE(2);i++){
  const start=cmap.readUInt32BE(4+i*8+4),format=cmap.readUInt16BE(start);
  if(format===12){const groups=cmap.readUInt32BE(start+12);for(let g=0;g<groups;g++){const o=start+16+g*12,a=cmap.readUInt32BE(o),z=cmap.readUInt32BE(o+4);if(point>=a&&point<=z)return cmap.readUInt32BE(o+8)+point-a;}}
  if(format===4&&point<=65535){const count=cmap.readUInt16BE(start+6)/2,end=start+14,begin=end+2*count+2,delta=begin+2*count,range=delta+2*count;
   for(let j=0;j<count;j++){if(point<cmap.readUInt16BE(begin+j*2)||point>cmap.readUInt16BE(end+j*2))continue;const d=cmap.readInt16BE(delta+j*2),r=cmap.readUInt16BE(range+j*2);if(!r)return(point+d)&65535;const glyph=cmap.readUInt16BE(range+j*2+r+2*(point-cmap.readUInt16BE(begin+j*2)));return glyph?(glyph+d)&65535:0;}
  }
 }
 return 0;
}
const chars='ěščřžýáíéúůďťňĚŠČŘŽÝÁÍÉÚŮĎŤŇ';
const files=['barlow-latin.woff2','barlow-latin-ext.woff2'].map(n=>new URL('../public/broadcast/fonts/'+n,import.meta.url)),tables=files.map(fontTables);
for(const char of chars){const index=char.codePointAt(0)>=256?1:0;assert.ok(glyphFor(tables[index].cmap,char.codePointAt(0)),`Missing glyph: ${char}`);}
console.log('Barlow Latin + Latin Extended: all '+chars.length+' Czech lowercase/uppercase glyphs verified.');
console.log('Font weights: '+tables.map(t=>t['OS/2'].readUInt16BE(4)).join(', ')+'; variable axes: '+tables.map(t=>!!t.fvar).join(', '));
