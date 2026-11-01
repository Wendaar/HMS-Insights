import {createHash} from 'node:crypto';
import {organizationEntry} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {speechParts,languageLocale} from '../../public/show-control/speech.js';
const xml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function speechSsml({text,language,rate,pauseMs},voice){
  const parts=speechParts(text).map(part=>xml(part)+`<break time="${Math.round(pauseMs*(/[.!?]$/.test(part)?1.5:1))}ms"/>`).join('');
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${languageLocale(language)}"><voice name="${xml(voice)}"><prosody rate="${Math.round((rate-1)*100)}%">${parts}</prosody></voice></speak>`;
}
// Disabled by default. Only authenticated operators may consume the provider quota.
// Cache and throttling are bounded, per warm function instance, not global quotas.
export function createShowSpeechHandler({env=process.env,fetchImpl=fetch,now=Date.now}={}){
  const cache=new Map(),requests=new Map(),pending=new Map();
  return async(req,res)=>{
    res.setHeader('cache-control','private, no-store');res.setHeader('x-content-type-options','nosniff');
    const fail=(code,error)=>res.status(code).json({error});
    if(!['GET','POST'].includes(req.method))return fail(405,'Nepovolená metoda.');
    let org;try{org=organizationEntry(req.query?.org,env);}catch{return fail(404,'Neznámá organizace.');}
    const prefix=`HMS_${org.code}_`,key=env.AZURE_SPEECH_KEY,region=env.AZURE_SPEECH_REGION;
    const configured=env[prefix+'TTS_ENABLED']==='true'&&!!key&&/^[a-z][a-z0-9]{1,39}$/.test(region??'');
    if(req.method==='GET')return res.status(200).json({org:org.code,configured,provider:configured?'azure':null,languages:['cs','en']});
    const secrets=[env[prefix+'OPERATIONS_SECRET'],env[prefix+'TOOLS_ADMIN_SECRET'],env[prefix+'WEBHOOK_SECRET'],...(org.code==='PHM'?[env.HMS_WEBHOOK_SECRET]:[])];
    if(!secrets.some(secret=>hasBearerSecret(req,secret)))return fail(401,'Serverový hlas vyžaduje kód Operations nebo správy organizace.');
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{return fail(403,'Nepovolený původ požadavku.');}}
    if(!configured)return fail(503,'Serverový hlas zatím není připojený. Použijte hlas zařízení.');
    if(!String(req.headers['content-type']??'').startsWith('application/json'))return fail(400,'Vyžadován JSON.');
    let body;try{if(Buffer.byteLength(JSON.stringify(req.body??''))>16000)throw Error();body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return fail(400,'Neplatné hlášení.');}
    const {text,language,rate,pauseMs}=body??{};
    if(typeof text!=='string'||!text.trim()||text.length>2400||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)||!['cs','en'].includes(language)||!Number.isFinite(rate)||rate<.75||rate>1.1||!Number.isInteger(pauseMs)||pauseMs<100||pauseMs>600)return fail(400,'Neplatný text, jazyk nebo tempo.');
    const voice=language==='cs'?'cs-CZ-AntoninNeural':'en-US-GuyNeural',ssml=speechSsml({text,language,rate,pauseMs},voice),id=createHash('sha256').update(org.code+ssml).digest('hex');
    for(const [k,v]of cache)if(v.expires<=now())cache.delete(k);
    const deliver=audio=>{res.setHeader('content-type','audio/mpeg');return res.status(200).send(audio);};
    if(cache.has(id))return deliver(cache.get(id).audio);
    if(pending.has(org.code))return fail(429,'Hlas se právě připravuje. Zkuste to za chvíli.');
    const times=(requests.get(org.code)??[]).filter(t=>t>now()-60000);if(times.length>=10)return fail(429,'Příliš mnoho nových hlášení. Vyčkejte minutu.');times.push(now());requests.set(org.code,times);pending.set(org.code,true);
    try{
      const response=await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3','User-Agent':'HMS-Show-Control'},body:ssml,signal:AbortSignal.timeout(18000)});
      if(!response.ok)throw Error();const audio=Buffer.from(await response.arrayBuffer());if(!audio.length||audio.length>2000000)throw Error();
      while(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(id,{audio,expires:now()+600000});return deliver(audio);
    }catch{return fail(503,'Serverový hlas není dostupný nebo vyčerpal limit. Zkuste hlas zařízení.');}finally{pending.delete(org.code);}
  };
}
