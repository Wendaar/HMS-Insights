export class BrowserAnalyzer {
 constructor(){this.pending=new Map();this.next=0;this.quality=null;}
 send(message,transfer=[]){const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.close('Webová analýza neodpověděla; zkuste rychlý režim'),60000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({...message,id},transfer);});}
 async init(quality='fast'){
  if(this.quality===quality&&this.ready)return this.ready;
  this.close();this.quality=quality;this.worker=new Worker('/virtual-camera/analyzer-worker.js',{type:'module'});
  this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);if(data.error)p.reject(Error(data.error));else p.resolve(data.result);};
  this.worker.onerror=()=>this.close('Webové AUTO nelze spustit. Použijte aktuální Chrome nebo Edge.');
  this.ready=this.send({action:'init',quality}).catch(error=>{this.quality=null;throw error;});return this.ready;
 }
 async analyze(canvas,{reset=false,quality='fast'}={}){await this.init(quality);const worker=this.worker,bitmap=await createImageBitmap(canvas);if(worker!==this.worker||!this.ready){bitmap.close();throw Error('Analýza byla přepnuta');}return this.send({action:'analyze',bitmap,time:performance.now()/1000,reset},[bitmap]);}
 close(reason='Analýza byla přepnuta'){this.worker?.terminate();this.worker=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(reason));}this.pending.clear();this.ready=null;this.quality=null;}
}
