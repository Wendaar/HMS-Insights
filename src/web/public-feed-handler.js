import {feedLanguage} from '../../public/insights-i18n.js';
import {organizationConfig} from '../app/organizations.js';
import {loadPublicFeedOptions,loadPublicFeedPage,loadPublicSelection} from '../infrastructure/postgres-repository.js';
import {renderPriklepyPage,renderFeedCards} from './render.js';
import {refreshFeedMedia} from '../app/feed-media.js';

// Page paths own their organization, even if a conflicting query is supplied.
// feedOrg is the fixed/captured destination parameter of the Vercel rewrites.
export function publicFeedOrganization(request,{html=false,env=process.env}={}){
  let value;
  if(html){
    const path=new URL(request.url??'/api/page','https://hms.invalid').pathname;
    const match=/^\/(?:priklepy|archiv)(?:\/([a-zA-Z0-9-]+))?\/?$/.exec(path);
    value=path==='/'?'PHM':match?(match[1]??'PHM'):(request.query?.feedOrg??'PHM');
  }else value=request.query?.org??'PHM';
  return organizationConfig(value,env);
}

export function createPublicFeedHandler({mode='selection',html=false,...options}={}){
  return async(request,response)=>{
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Cache-Control','no-store');
    const fail=(code,message)=>html?response.status(code).send(message):response.status(code).json({error:message});
    if(request.method!=='GET'){response.setHeader('Allow','GET');return fail(405,'Method not allowed');}
    try{
      const env=options.env??process.env,org=publicFeedOrganization(request,{html,env}),query=request.query??{};
      const lang=feedLanguage(query.lang,org.code);
      const requestedTeamId=typeof query.teamId==='string'?query.teamId:'';
      const teamId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedTeamId)?requestedTeamId:null;
      const common={env,organizationId:org.id,query:query.q,group:query.group,team:query.team};
      const load=mode==='selection'?(options.loadSelection??loadPublicSelection):(options.loadPage??loadPublicFeedPage);
      const [page,filterOptions]=await Promise.all([
        load(mode==='selection'?{...common,teamId,limit:30}:{...common,season:query.season,phase:query.phase,venue:query.venue,sponsor:query.sponsor,limit:html?40:query.limit,offset:html?0:query.offset}),
        html?(options.loadOptions??loadPublicFeedOptions)({env,organizationId:org.id}):null,
      ]);
      page.items=await(options.refreshFeedMedia??refreshFeedMedia)(page.items,options);
      // Only public registry metadata crosses the renderer/API boundary.
      const organization={code:org.code,slug:org.slug,name:org.name};
      if(html){
        response.setHeader('Content-Type','text/html; charset=utf-8');
        response.setHeader('Cache-Control','s-maxage=60, stale-while-revalidate=300');
        return response.status(200).send(renderPriklepyPage(page.items,{...page,filterOptions,mode,organization,lang,embed:query.embed==='1',teamId,teamName:teamId?page.items.find(item=>item.team)?.team:null}));
      }
      return response.status(200).json({...page,organization:org.code,html:renderFeedCards(page.items,page.offset??0,lang)});
    }catch(error){
      // Never expose/log upstream connection strings, credentials or SQL errors.
      return fail(error instanceof TypeError?404:503,error instanceof TypeError?'Organizace nebyla nalezena.':'Příklepy této organizace zatím nejsou dostupné.');
    }
  };
}
