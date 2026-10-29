const token=(process.env.HMS_PHM_API_TOKEN||process.env.HMS_API_TOKEN||'').trim();
const checks=[];
async function check(url,authenticated){
 try{
 const response=await fetch(url,{headers:{accept:'application/json',...(authenticated?{authorization:'Bearer '+token}:{})},redirect:'error',signal:AbortSignal.timeout(12000)});
 const result={path:new URL(url).pathname,authenticated,status:response.status};
 if(response.ok){
 const data=await response.json();
 result.kind=Array.isArray(data)?'array':typeof data;
 if(Array.isArray(data)){result.count=data.length;result.fields=Object.keys(data[0]||{});result.playerFields=Object.keys(data[0]?.Player||{});result.hasEmail=Object.hasOwn(data[0]?.Player||{},'email');}
 else result.fields=Object.keys(data||{});
 }checks.push(result);
 }catch{checks.push({path:new URL(url).pathname,authenticated,status:'transport_error'});}
}
if(process.env.VERCEL_ENV==='preview'&&token){
await check('https://public-api.prod.hms.wootera.net/api/v1/organization',true);
const url=new URL('https://api.prod.hms.wootera.net/admin/entities');
const params={entity:'SeasonPlayerRegistration',relations:'Player(firstName,lastName,logoUrl,playerId,email),Player>Teams(name,logoUrl,teamId),Season(name,seasonId,playerRegFeeMandatory,playerRegFee),Season>Competition(name,logoUrl,competitionId)',extraAttributes:'',onlyAttributes:'seasonPlayerRegistrationId,createdAt,updatedAt,updatedBy,isAccepted,isPaid,isConfirmed,paymentMethod',search:'',leanRelations:'1',role:'SYSTEM_ADMIN',organizationId:'"BB669217-41EB-4162-8040-A73F49A43570"'};
for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
await check(url,true);
await check(url,false);
}
console.log('REGISTRATION_ACCESS_CHECK '+JSON.stringify({configured:!!token,environment:process.env.VERCEL_ENV,checks}));
