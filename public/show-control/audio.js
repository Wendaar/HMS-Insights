import {spokenText,speechParts,defaultPronunciations} from './speech.js';
// One music bed and one effect; speech and its timed pauses duck both.
export class ShowAudio{
  constructor({synth=globalThis.speechSynthesis,AudioClass=globalThis.Audio,Utterance=globalThis.SpeechSynthesisUtterance,onChange=()=>{}}={}){
    Object.assign(this,{synth,AudioClass,Utterance,onChange});this.tracks={};this.volume=.65;this.voiceVolume=1;this.duck=.12;this.rate=.9;this.pauseMs=250;this.language='cs';this.pronunciations=defaultPronunciations;this.speaking=false;this.serial=0;this.paused=false;
  }
  levels(){for(const t of Object.values(this.tracks))t.audio.volume=this.volume*(t.gain??1)*(this.speaking?this.duck:1);}
  async play(blob,channel,{loop=false,label='',gain=1}={}){
    this.stopTrack(channel);const ownsUrl=blob instanceof Blob,url=ownsUrl?URL.createObjectURL(blob):blob,audio=new this.AudioClass(url),track={audio,url,label,ownsUrl,gain};this.tracks[channel]=track;
    audio.loop=loop;this.levels();audio.onended=()=>{if(this.tracks[channel]===track)this.stopTrack(channel);};
    audio.onerror=()=>{if(this.tracks[channel]===track){this.stopTrack(channel);this.onChange('Zvuk nelze přehrát. Zkuste jiný formát.');}};
    try{await audio.play();if(this.tracks[channel]===track)this.onChange();}catch(e){if(this.tracks[channel]===track)this.stopTrack(channel);throw e;}
  }
  stopTrack(channel){const t=this.tracks[channel];if(!t)return;delete this.tracks[channel];t.audio.pause();t.audio.removeAttribute('src');t.audio.load();if(t.ownsUrl)URL.revokeObjectURL(t.url);this.onChange();}
  cancel(){this.serial++;clearTimeout(this.pauseTimer);clearTimeout(this.watchdog);if(this.voiceAudio){this.voiceAudio.pause();this.voiceAudio.removeAttribute('src');this.voiceAudio.load();this.voiceAudio=null;URL.revokeObjectURL(this.voiceUrl);this.voiceUrl=null;}this.pendingPart=null;this.paused=false;const done=this.finish;this.finish=null;this.utterance=null;this.synth?.cancel();this.speaking=false;this.levels();done?.('New');}
  speak(text,voice,done){
    this.cancel();if(!this.synth||!this.Utterance)throw new Error('Prohlížeč nepodporuje hlasatele.');
    this.synth.resume?.();
    const serial=this.serial,parts=speechParts(spokenText(text,this.pronunciations,this.language));let index=0;
    this.finish=done;this.speaking=true;this.levels();
    const finish=status=>{if(this.serial!==serial)return;this.serial++;clearTimeout(this.watchdog);this.finish=null;this.utterance=null;this.speaking=false;this.levels();done(status);this.onChange();};
    const next=()=>{
      if(this.serial!==serial)return;if(this.paused){this.pendingPart=next;return;}this.pendingPart=null;
      if(index>=parts.length){finish('Done');return;}
      const part=parts[index++],u=new this.Utterance(part);u.lang=this.language==='cs'?'cs-CZ':'en-US';if(voice)u.voice=voice;u.volume=this.voiceVolume;u.rate=this.rate;this.utterance=u;
      const arm=ms=>{clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>{if(this.paused){arm(ms);return;}if(this.serial!==serial)return;finish('New');this.synth.cancel();this.onChange('Hlas neodpovídá. Zkuste obnovit hlasy nebo přepněte na serverový hlas.');},ms);this.watchdog.unref?.();};
      u.onstart=()=>arm(Math.max(20000,part.length*200/this.rate));arm(12000);
      u.onend=()=>{if(this.serial!==serial||this.utterance!==u)return;clearTimeout(this.watchdog);this.utterance=null;if(index>=parts.length)finish('Done');else this.pauseTimer=setTimeout(next,this.pauseMs*(/[.!?]$/.test(part)?1.5:1));};
      u.onerror=()=>{if(this.serial!==serial||this.utterance!==u)return;finish('New');this.onChange('Hlas se nepodařilo přehrát. Zkuste jiný hlas nebo serverové TTS.');};
      try{this.synth.speak(u);}catch{finish('New');this.onChange('Hlas se nepodařilo spustit.');}
    };next();
  }
  async speakFile(blob,done){
    this.cancel();const serial=this.serial,url=URL.createObjectURL(blob),audio=new this.AudioClass(url);this.voiceAudio=audio;this.voiceUrl=url;this.finish=done;this.speaking=true;audio.volume=this.voiceVolume;this.levels();
    const finish=status=>{if(this.serial!==serial)return;this.finish=null;this.cancel();done(status);this.onChange();};
    audio.onended=()=>finish('Done');audio.onerror=()=>{finish('New');this.onChange('Audio hlasatele nelze přehrát.');};
    try{await audio.play();}catch(error){finish('New');throw error;}
  }
  pause(){this.voiceAudio?.pause();this.paused=true;this.synth?.pause();for(const t of Object.values(this.tracks))t.audio.pause();}
  async resume(){this.paused=false;if(this.voiceAudio)await this.voiceAudio.play();this.synth?.resume();const pending=this.pendingPart;this.pendingPart=null;pending?.();await Promise.all(Object.values(this.tracks).map(t=>t.audio.play()));}
  stop(){this.cancel();for(const c of Object.keys(this.tracks))this.stopTrack(c);this.onChange();}
}
