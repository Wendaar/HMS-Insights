import {publicOrganizations} from '../app/organizations.js';
import { browseMedia, mediaGame } from '../app/media-engine.js';
export function createStudioHandler(options={}) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const q=req.query??{};
    if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:q.lang==='en'?'Read only.':'Pouze čtení.'});}
    try {
      const integer=(value,max)=>{const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0||n>max)throw new TypeError('Neplatná stránka.');return n;};
      if(q.catalog==='1')return res.status(200).json({organizations:publicOrganizations(options.env??process.env)});
      const result=q.gameId
        ? await (options.mediaGame??mediaGame)(q.org,q.gameId,{...options,refresh:q.refresh==='1'})
        : await (options.browseMedia??browseMedia)({org:q.org,query:typeof q.query==='string'?q.query.slice(0,160):'',type:typeof q.type==='string'?q.type:'',filter:q.filter??'Today',section:q.section==='insights'?'insights':'games',offset:integer(q.offset,100000),windowPage:integer(q.windowPage,120)},options);
      return res.status(200).json(result);
    } catch(e) {
      const invalid=e instanceof TypeError&&['Neplatná organizace.','Neplatná stránka.','Neplatný filtr.','Neplatné gameId.','Neplatný typ Insightu.'].includes(e.message);
      return res.status(invalid?400:503).json({error:q.lang==='en'?(invalid?'Invalid organization, filter, game ID or page.':'Data unavailable. Check the selected organization connection or try again.'):(invalid?e.message:'Data nejsou dostupná. Zkontrolujte připojení vybrané organizace nebo zkuste načtení znovu.')});
    }
  };
}
