import {matchPreview} from '../app/game-day.js';
import {organizationEntry} from '../app/organizations.js';
import {comparisonDestination} from '../app/match-links.js';
import {renderMatchPreviewPage} from './match-preview-page.js';
import {isGameId} from '../domain/game-summary.js';
export function createMatchPreviewHandler(options={}){
 return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');res.setHeader('referrer-policy','no-referrer');
  if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).send('Read only');}
  const q=req.query??{},lang=q.lang==='en'?'en':'cs';
  if(!isGameId(q.gameId))return res.status(400).send('Invalid game ID');
  try{const org=organizationEntry(q.org,options.env??process.env),p=await(options.preview??matchPreview)(org.code,q.gameId,{...options,includeComparison:q.action!=='analysis'});
   if(p.org!==org.code)throw new Error('Foreign fixture');
   if(q.action==='analysis'){const target=comparisonDestination(org.slug,p,lang);res.setHeader('location',target);return res.status(302).send('');}
   res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('content-security-policy',"default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
   return res.status(200).send(renderMatchPreviewPage(p,{lang}));
  }catch(e){return res.status(e instanceof TypeError?400:503).send(lang==='en'?'Match preview or comparison is currently unavailable.':'Předzápasový přehled nebo porovnání zatím není dostupné.');}
 };
}
