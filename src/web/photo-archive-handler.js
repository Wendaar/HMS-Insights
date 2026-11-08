import {organizationEntry} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {hasOperationsSession,sessionCookie,clearSessionCookie} from '../security/operations-session.js';
import {createPhotoArchive,photoArchiveEnabled,PhotoArchiveError} from '../app/photo-archive.js';
export function createPhotoArchiveHandler(options={}){
  const env=options.env ?? process.env,service=options.service ?? createPhotoArchive({...options,env});
  return async(req,res)=>{
    res.setHeader('cache-control','private, no-store');res.setHeader('vary','Authorization, Cookie');res.setHeader('referrer-policy','no-referrer');res.setHeader('x-content-type-options','nosniff');
    const fail=(status,error)=>res.status(status).json({error});
    if(!photoArchiveEnabled(env))return fail(503,'Fotoarchiv je zatím dostupný pouze v pilotním Preview.');
    const q=req.query || {},action=q.action || 'catalog',writes=['session','logout','import','decide'];
    if(!['access','session','logout','catalog','case','import','decide','archive','player-photos'].includes(action))return fail(400,'Neznámá operace.');
    const method=writes.includes(action)?'POST':'GET';if(req.method!==method){res.setHeader('allow',method);return fail(405,'Nepovolená metoda.');}
    let org;try{org=organizationEntry(q.org || 'phm',env);}catch{return fail(404,'Neznámá organizace.');}
    if(org.code!=='PHM')return fail(404,'Pilot fotoarchivu je nyní dostupný pro PHM.');
    const secret=env.HMS_PHM_OPERATIONS_SECRET;
    const bearer=hasBearerSecret({headers:{authorization:req.headers?.authorization}},secret);
    const authorized=bearer || hasOperationsSession(req,org,secret,options.now?.());
    if(action==='access')return res.status(200).json({org:org.code,configured:!!secret,authorized,storageReady:service.ready,sandbox:true});
    if(writes.includes(action) && req.headers?.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)throw Error();}catch{return fail(403,'Požadavek pochází z jiné stránky.');}}
    if(action==='logout'){res.setHeader('set-cookie',clearSessionCookie(org));return res.status(200).json({authorized:false});}
    if(!secret)return fail(503,'Kód Operations pro PHM není nastavený.');
    if(action==='session'){
      if(!bearer)return fail(401,'Zadejte platný kód Operations pro PHM.');
      res.setHeader('set-cookie',sessionCookie(org,secret,options.now?.()));return res.status(200).json({authorized:true});
    }
    if(!authorized)return fail(401,'Přihlaste se kódem Operations pro PHM.');
    try{
      if(action==='catalog')return res.status(200).json({org:org.code,cases:await service.catalog(org.code)});
      if(action==='case')return res.status(200).json(await service.read(org.code,q.gameId));
      if(action==='archive')return res.status(200).json({org:org.code,players:await service.archive(org.code)});
      if(action==='player-photos'){
        if(typeof q.playerId!=='string' || !/^[a-fA-F0-9-]{36}$/.test(q.playerId))return fail(400,'Vyberte platné HMS ID hráče.');
        const [player]=await service.archive(org.code,q.playerId);
        return res.status(200).json({org:org.code,playerId:q.playerId,photos:(player?.photos || []).map(({id,previewUrl,thumbnailUrl,originalUrl,gameId,gameTitle,playedOn,teamId,teamName})=>({id,previewUrl,thumbnailUrl,originalUrl,gameId,gameTitle,playedOn,teamId,teamName}))});
      }
      if(!String(req.headers?.['content-type'] || '').startsWith('application/json'))return fail(400,'Vyžadován JSON.');
      if(Buffer.byteLength(JSON.stringify(req.body ?? ''))>16000)return fail(413,'Požadavek je příliš velký.');
      let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body || Array.isArray(body))throw Error();}catch{return fail(400,'Neplatný požadavek.');}
      const result=action==='import'?await service.importCase(org.code,body.gameId,body.revision,'operations:PHM'):await service.decide(org.code,body,'operations:PHM');
      return res.status(200).json(result);
    }catch(error){return error instanceof PhotoArchiveError?fail(error.status,error.message):fail(503,'Fotoarchiv nelze načíst nebo uložit. Ověřte připojení databáze, HMS a Flickr.');}
  };
}
