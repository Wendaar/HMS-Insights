import {createHash,timingSafeEqual} from 'node:crypto';
export default async function probe(req,res){
 res.setHeader('cache-control','private, no-store');res.setHeader('x-robots-tag','noindex, nofollow');res.setHeader('referrer-policy','no-referrer');
 const value=typeof req.headers?.authorization==='string'?req.headers.authorization:'';
 const key=value.startsWith('Bearer ')?value.slice(7):'';
 const actual=createHash('sha256').update(key).digest();
 if(req.method!=='GET'||process.env.VERCEL_ENV!=='preview'||Date.now()>1793290085380||!key||!timingSafeEqual(actual,Buffer.from('a64698b25019e53dfaabb3e1199cdc82e2d59637f3e09b891a4f6817820db720','hex')))return res.status(404).json({error:'Unavailable'});
 const token=(process.env.HMS_PHM_API_TOKEN||process.env.HMS_API_TOKEN||'').trim();
 if(!token)return res.status(503).json({configured:false});
 const checks=[];
 const check=async(url,authenticated)=>{
  try{
   const r=await fetch(url,{headers:{accept:'application/json',...(authenticated?{authorization:'Bearer '+token}:{})},redirect:'error',signal:AbortSignal.timeout(12000)});
   const result={path:new URL(url).pathname,authenticated,status:r.status};
   if(r.ok){
    const data=await r.json();
    result.kind=Array.isArray(data)?'array':typeof data;
    if(Array.isArray(data)){result.count=data.length;result.fields=Object.keys(data[0]||{});result.playerFields=Object.keys(data[0]?.Player||{});result.hasEmail=Object.hasOwn(data[0]?.Player||{},'email');
     result.targetSeasonCount=data.filter(row=>row.Season?.seasonId?.toLowerCase()==='e6134160-47cf-11f1-a223-bfdfbdd3a64b'&&row.Season?.Competition?.competitionId?.toLowerCase()==='c7c0bb15-5d29-415d-851e-5d777c6cc621').length;
    }else result.fields=Object.keys(data||{});
   }
   checks.push(result);
  }catch{checks.push({path:new URL(url).pathname,authenticated,status:'transport_error'});}
 };
 await check('https://public-api.prod.hms.wootera.net/api/v1/organization',true);
 const url=new URL('https://api.prod.hms.wootera.net/admin/entities');
 const params={entity:'SeasonPlayerRegistration',relations:'Player(firstName,lastName,logoUrl,playerId,email),Player>Teams(name,logoUrl,teamId),Season(name,seasonId,playerRegFeeMandatory,playerRegFee),Season>Competition(name,logoUrl,competitionId)',extraAttributes:'',onlyAttributes:'seasonPlayerRegistrationId,createdAt,updatedAt,updatedBy,isAccepted,isPaid,isConfirmed,paymentMethod',search:'',leanRelations:'1',role:'SYSTEM_ADMIN',organizationId:'"BB669217-41EB-4162-8040-A73F49A43570"'};
 for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
 await check(url,true);
 await check(url,false);
 return res.status(200).json({configured:true,checks});
}
