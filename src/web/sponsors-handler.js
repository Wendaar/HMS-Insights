import {organizationConfig} from '../app/organizations.js';
import {loadSponsorCatalog} from '../app/sponsors.js';
export function createSponsorsHandler(options={}){
  return async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
    if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Read only.'});}
    try{
      const org=organizationConfig(req.query?.org??'PHM',options.env??process.env);
      if(!org.token)throw new Error('Unconfigured');
      return res.status(200).json(await (options.loadSponsors??loadSponsorCatalog)(org,options));
    }catch(error){return res.status(error instanceof TypeError?400:503).json({error:'Sponsor catalog unavailable for this organization.'});}
  };
}
