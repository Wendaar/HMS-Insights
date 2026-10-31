// One music bed and one effect; speech ducks both. Generation guards ignore stale callbacks.
export class ShowAudio{
  constructor({synth=globalThis.speechSynthesis,AudioClass=globalThis.Audio,Utterance=globalThis.SpeechSynthesisUtterance,onChange=()=>{}}={}){
    Object.assign(this,{synth,AudioClass,Utterance,onChange});this.tracks={};this.volume=.65;this.voiceVolume=1;this.duck=.12;this.speaking=false;this.serial=0;
  }
  levels(){for(const t of Object.values(this.tracks))t.audio.volume=this.volume*(this.speaking?this.duck:1);}
  async play(blob,channel,{loop=false,label=''}={}){
    this.stopTrack(channel);const url=URL.createObjectURL(blob),audio=new this.AudioClass(url),track={audio,url,label};this.tracks[channel]=track;
    audio.loop=loop;this.levels();audio.onended=()=>{if(this.tracks[channel]===track)this.stopTrack(channel);};
    audio.onerror=()=>{if(this.tracks[channel]===track){this.stopTrack(channel);this.onChange('Zvuk nelze přehrát. Zkuste jiný formát.');}};
    try{await audio.play();if(this.tracks[channel]===track)this.onChange();}catch(e){if(this.tracks[channel]===track)this.stopTrack(channel);throw e;}
  }
  stopTrack(channel){const t=this.tracks[channel];if(!t)return;delete this.tracks[channel];t.audio.pause();t.audio.removeAttribute('src');t.audio.load();URL.revokeObjectURL(t.url);this.onChange();}
  cancel(){this.serial++;const done=this.finish;this.finish=null;this.utterance=null;this.synth?.cancel();this.speaking=false;this.levels();done?.('New');}
  speak(text,voice,done){
    this.cancel();if(!this.synth||!this.Utterance)throw new Error('Prohlížeč nepodporuje hlasatele.');
    const serial=this.serial,u=new this.Utterance(text);u.lang='cs-CZ';u.voice=voice;u.volume=this.voiceVolume;this.utterance=u;
    this.finish=done;this.speaking=true;this.levels();
    const finish=status=>{if(this.serial!==serial)return;this.serial++;this.finish=null;this.utterance=null;this.speaking=false;this.levels();done(status);this.onChange();};
    u.onend=()=>finish('Done');u.onerror=()=>{if(this.serial!==serial)return;finish('New');this.onChange('Hlas se nepodařilo přehrát. Zkontrolujte český hlas.');};
    try{this.synth.speak(u);}catch(e){finish('New');throw e;}
  }
  pause(){this.synth?.pause();for(const t of Object.values(this.tracks))t.audio.pause();}
  async resume(){this.synth?.resume();await Promise.all(Object.values(this.tracks).map(t=>t.audio.play()));}
  stop(){this.cancel();for(const c of Object.keys(this.tracks))this.stopTrack(c);this.onChange();}
}
