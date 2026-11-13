const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const number=(v,f,a=0,b=1)=>clamp(Number.isFinite(Number(v))?Number(v):f,a,b);
export function calibration(value={}) {
 value=value&&typeof value==='object'?value:{};
 const left=number(value.left,.08,0,.8),right=number(value.right,.94,left+.1,1);
 const top=number(value.top,.30,0,.8),bottom=number(value.bottom,.73,top+.05,1);
 return {left,right,center:number(value.center,.5,left,right),top,bottom,
  benchTop:number(value.benchTop,.27,0,1),benchBottom:number(value.benchBottom,.34,0,1)};
}
export function settings(value={}) {value=value&&typeof value==='object'?value:{};return {sensitivity:number(value.sensitivity,.5,.1,1),preferredZoom:number(value.preferredZoom,1.8,1,3),calibration:calibration(value.calibration)};}
