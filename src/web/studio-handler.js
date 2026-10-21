import { browseMedia, mediaGame } from '../app/media-engine.js';
export function createStudioHandler(options={}) {
  return async (req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Pouze čtení.'});}
    const q=req.query??{};
    try {
      const integer=(value,max)=>{const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0||n>max)throw new TypeError('Neplatná stránka.');return n;};
      const result=q.gameId
        ? await (options.mediaGame??mediaGame)(q.org,q.gameId,{...options,refresh:q.refresh==='1'})
        : await (options.browseMedia??browseMedia)({org:q.org,filter:q.filter??'Today',section:q.section==='insights'?'insights':'games',offset:integer(q.offset,100000),windowPage:integer(q.windowPage,120)},options);
      return res.status(200).json(result);
    } catch(e) {
      return res.status(e instanceof TypeError?400:503).json({error:e instanceof TypeError?e.message:'Data nejsou dostupná. Zkontrolujte připojení vybrané organizace nebo zkuste načtení znovu.'});
    }
  };
}
