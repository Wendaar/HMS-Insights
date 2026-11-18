import {organizationEntry,publicOrganizations} from '../app/organizations.js';
import {publicComparisonCatalog,comparisonCatalog,readTeamComparison} from '../app/team-comparison.js';
export function createTeamComparisonHandler(options={}){
 return async(req,res)=>{
  res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
  const q=req.query??{},en=q.lang==='en',fail=(code,cs,english)=>res.status(code).json({error:en?english:cs});
  if(req.method!=='GET'){res.setHeader('allow','GET');return fail(405,'Nepovolená metoda.','Method not allowed.');}
  if(q.action==='organizations')return res.status(200).json({organizations:publicOrganizations(options.env??process.env)});
  let org;try{org=organizationEntry(q.org,options.env??process.env);}catch{return fail(404,'Neznámá organizace.','Unknown organization.');}
  try{
   if(q.action==='catalog'){const catalog=await publicComparisonCatalog(org.code,q,options);if(q.groupId||q.phaseId)await comparisonCatalog(org.code,q,options);return res.status(200).json(catalog);}
   if(q.action==='scope')return res.status(200).json(await comparisonCatalog(org.code,q,options));
   if(q.action==='compare')return res.status(200).json(await readTeamComparison(org.code,q,options));
   return fail(400,'Neznámá operace.','Unknown action.');
  }catch(e){return e instanceof TypeError?fail(400,'Neplatný rozsah odkazu: zkontrolujte soutěž, sezonu, uzamčení sezony, divizi, fázi a hranici startů.','Invalid link scope: check competition, season, season lock, division, phase and starts threshold.'):fail(503,'Porovnání není dostupné. Ověřte připojení organizace a zkuste to znovu.','Comparison is unavailable. Check the organization connection and try again.');}
 };
}
