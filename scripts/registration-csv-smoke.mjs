import {registrationSnapshotStore,registrationTeamCatalog,registrationPortraits} from '../src/infrastructure/registration-snapshots.js';
import {registrationLinkStore} from '../src/infrastructure/registration-links.js';
import {createRegistrationControlHandler} from '../src/web/registration-control-handler.js';
import {REGISTRATION_SCOPE} from '../src/app/registration-control.js';
if(process.env.VERCEL_ENV==='preview'){
 const result={previewOnly:true};
 try{
 const env=process.env,secret=env.HMS_PHM_REGISTRATIONS_ADMIN_SECRET||env.HMS_PHM_TOOLS_ADMIN_SECRET||env.HMS_PHM_OPERATIONS_SECRET||env.HMS_PHM_WEBHOOK_SECRET||env.HMS_WEBHOOK_SECRET;
 const teams=await registrationTeamCatalog({env});result.teams=teams.length;
 await registrationSnapshotStore({env}).get(REGISTRATION_SCOPE);result.snapshotStorage=true;
 await registrationLinkStore({env}).list(REGISTRATION_SCOPE);result.linkStorage=true;
 const csv=['Player;Teams;Competition;Season;Accepted by Player;Player ID;ID','Synthetic QA;'+teams[0].name+';PHM Cup;2026-2027;YES;00000000-0000-4000-8000-000000000001;00000000-0000-4000-8000-000000000002'].join('\n');
 const res={code:0,setHeader(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}};
 await createRegistrationControlHandler()({method:'POST',headers:{authorization:'Bearer '+secret,origin:'https://preview.invalid',host:'preview.invalid'},query:{action:'preview-import'},body:{filename:'Synthetic-All.csv',csv}},res);
 result.previewStatus=res.code;result.previewAssigned=res.data?.summary?.assigned;
 await registrationPortraits({teamId:teams[0].id,players:[{playerId:'00000000-0000-4000-8000-000000000001'}]},{env});result.photoQuery=true;
 }catch{result.failed=true;}
 console.log('REGISTRATION_CSV_SMOKE '+JSON.stringify(result));
 if(result.failed||result.previewStatus!==200)process.exitCode=1;
}
