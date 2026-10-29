import {createHmac} from 'node:crypto';
import {REGISTRATION_SCOPE, readRegistrationTeams, RegistrationSourceError, uuid} from '../app/registration-control.js';
import {registrationLinkStore, validTeamToken} from '../infrastructure/registration-links.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {hasOperationsSession, sessionCookie, clearSessionCookie} from '../security/operations-session.js';
import {buildRegistrationImport,RegistrationCsvError} from '../app/registration-csv.js';
import {registrationSnapshotStore,registrationTeamCatalog,registrationPortraits} from '../infrastructure/registration-snapshots.js';

const adminOrg = {code: 'PHM_REGISTRATIONS'};
const teamCookie = 'hms_registration_team';
const readCookie = req => (req.headers?.cookie ?? '').split(';').map(s => s.trim()).find(s => s.startsWith(teamCookie + '='))?.slice(teamCookie.length + 1);
const teamCookieValue = (token, seconds) => `${teamCookie}=${token}; Path=/api; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
const adminSecret = env => env.HMS_PHM_REGISTRATIONS_ADMIN_SECRET || env.HMS_PHM_TOOLS_ADMIN_SECRET || env.HMS_PHM_OPERATIONS_SECRET || env.HMS_PHM_WEBHOOK_SECRET || env.HMS_WEBHOOK_SECRET;
const safeLink = row => ({teamId:row.team_id, revision:row.revision, createdAt:row.created_at, expiresAt:row.expires_at, revoked:!!row.revoked_at});

export function createRegistrationControlHandler(options = {}) {
  const env = options.env ?? process.env, store = options.store ?? registrationLinkStore({env});
  const scope = REGISTRATION_SCOPE, snapshots=options.snapshots??registrationSnapshotStore({env});
  const getData=async()=>{
    if(options.read)return {teams:await options.read({env}),source:{type:'api',label:'HMS API'}};
    const saved=await snapshots.get(scope);
    if(!saved)throw new RegistrationCsvError('Zatím není nahraný export registrací.');
    return {teams:saved.payload.teams,source:{type:'csv',label:'Ruční export HMS',uploadedAt:saved.uploadedAt,revision:saved.revision,
      summary:saved.payload.summary,limitations:saved.payload.limitations}};
  };
  const portraits=options.portraits??registrationPortraits;
  return async (req, res) => {
    for (const [k,v] of Object.entries({'cache-control':'private, no-store',vary:'Authorization, Cookie','referrer-policy':'no-referrer',
      'x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow, noarchive'})) res.setHeader(k,v);
    const fail = (status, error, code) => res.status(status).json({error, code});
    const action = req.query?.action ?? 'team', secret = adminSecret(env);
    const post = ['login','logout','exchange','rotate','revoke','team-logout','preview-import','import'].includes(action);
    if (!['access','login','logout','catalog','admin-team','rotate','revoke','exchange','team','team-logout','preview-import','import'].includes(action)) return fail(400,'Neznámá operace.','action');
    if (req.method !== (post ? 'POST' : 'GET')) {res.setHeader('allow', post ? 'POST' : 'GET'); return fail(405,'Nepovolená metoda.','method');}
    // Fixed organization/competition/season; clients cannot choose authorization scope.
    if (['org','seasonId','competitionId','organizationId','token'].some(k => req.query?.[k] !== undefined) ||
      ['team','exchange'].includes(action) && req.query?.teamId !== undefined) return fail(400,'Rozsah odkazu nelze změnit.','scope');
    if (post) {
      // Browser mutations require an exact same-origin request, including login/logout.
      try { const origin = new URL(req.headers?.origin); if (origin.host !== req.headers?.host || !['https:','http:'].includes(origin.protocol)) throw Error(); }
      catch { return fail(403,'Požadavek musí pocházet z této aplikace.','origin'); }
    }
    if (req.body && Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) > (['preview-import','import'].includes(action)?4_000_000:2048)) return fail(413,'Příliš velký požadavek.','body');
    if (action === 'access') return res.status(200).json({configured:!!secret && !!env.DATABASE_URL,
      authorized:hasOperationsSession(req,adminOrg,secret), sourceMode:'csv', label:scope.label});
    if (action === 'logout') {res.setHeader('set-cookie',clearSessionCookie(adminOrg)); return res.status(200).json({authorized:false});}
    if (action === 'team-logout') {res.setHeader('set-cookie',teamCookieValue('',0)); return res.status(200).json({authorized:false});}
    if (!secret) return fail(503,'Správa registrací čeká na serverové nastavení přístupu.','configuration');
    try {
      if (['login','exchange','team'].includes(action)) {
        // Vercel supplies x-real-ip; never trust a client-controlled forwarding chain.
        const ip = env.VERCEL ? req.headers?.['x-real-ip'] ?? 'unknown' : req.socket?.remoteAddress ?? 'local';
        const bucket = createHmac('sha256',secret).update(`${action}:${String(ip).slice(0,128)}:${Math.floor(Date.now()/600000)}`).digest('hex');
        if (!await store.rate(bucket, action === 'team' ? 120 : 15)) {res.setHeader('retry-after','600'); return fail(429,'Příliš mnoho pokusů. Zkuste to za 10 minut.','rate_limit');}
      }
      const bearer = hasBearerSecret({headers:{authorization:req.headers?.authorization}},secret);
      if (action === 'login') {
        if (!bearer) return fail(401,'Zadejte platný interní přístupový kód.','access');
        res.setHeader('set-cookie',sessionCookie(adminOrg,secret)); return res.status(200).json({authorized:true});
      }
      if (['team','exchange'].includes(action)) {
        const authorization = req.headers?.authorization;
        const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : readCookie(req);
        const link = validTeamToken(token) ? await store.resolve(token,scope) : null;
        if (!link) return fail(404,'Odkaz není platný, byl zrušen nebo vypršel. Vyžádejte si nový od správce PHM.','link_unavailable');
        if (action === 'exchange') {res.setHeader('set-cookie',teamCookieValue(token,8*60*60)); return res.status(200).json({authorized:true});}
        const {teams,source} = await getData();
        const team = teams.find(t => t.teamId === link.team_id.toLowerCase());
        if (!team) return fail(503,'Tým není v úplném zdroji této sezony. Kontaktujte správce PHM.','team_unavailable');
        let shown=team;try{shown=await portraits(team,{env});}catch{/* Portraits are optional and never alter identity or payment data. */}
        return res.status(200).json({label:scope.label,team:shown,source,readAt:new Date().toISOString()});
      }
      if (!bearer && !hasOperationsSession(req,adminOrg,secret)) return fail(401,'Přihlaste se interním přístupovým kódem.','access');
      if(['preview-import','import'].includes(action)){
        let body;
        try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(!body||typeof body.csv!=='string'||typeof body.filename!=='string'||!body.filename.toLowerCase().endsWith('.csv')||body.mappings&&(!Object.getPrototypeOf(body.mappings)||typeof body.mappings!=='object'||Array.isArray(body.mappings)))throw Error();}
        catch{return fail(400,'Vyberte platný CSV soubor.','csv');}
        const previous=await snapshots.get(scope),revision=previous?.revision??0;
        const directory=await(options.teamCatalog??registrationTeamCatalog)({env}),catalog=Array.isArray(directory)?directory:directory.teams;
        const parsed=buildRegistrationImport(body.csv,catalog,{previous:previous?.payload,mappings:body.mappings??{},filename:body.filename,knownTeams:directory.knownTeams??catalog});
        if(action==='preview-import')return res.status(200).json({revision,sourceHash:parsed.sourceHash,summary:parsed.summary,limitations:parsed.limitations,
          pending:parsed.pending,teams:catalog.map(t=>({teamId:t.id,name:t.name})),filename:parsed.filename});
        if(body.completeExport!==true)return fail(400,'Potvrďte, že jde o úplný export All bez filtrů.','coverage');
        if(!Number.isSafeInteger(body.revision)||body.revision!==revision||body.sourceHash!==parsed.sourceHash)return fail(409,'Data nebo soubor se změnily. Načtěte nový náhled importu.','revision');
        if(parsed.summary.unassigned&&!body.acceptExcluded)return fail(400,'Zkontrolujte nepřiřazené hráče a potvrďte jejich vynechání.','unassigned');
        if(!parsed.summary.assigned)return fail(422,'Žádný hráč není bezpečně přiřazen k týmu. Import nebyl uložen.','unassigned');
        const saved=await snapshots.save(scope,parsed,revision);
        if(!saved)return fail(409,'Jiný správce mezitím nahrál nový export. Načtěte nový náhled.','revision');
        return res.status(200).json({revision:saved.revision,uploadedAt:saved.uploaded_at,summary:parsed.summary});
      }
      if (action === 'catalog') {
        const links = await store.list(scope);
        try {
          const {teams,source} = await getData();
          return res.status(200).json({label:scope.label,sourceReady:true,source,teams:teams.map(t => ({teamId:t.teamId,name:t.name,players:t.players.length})),links:links.map(safeLink)});
        } catch {
          // Revocation must remain usable during an HMS outage.
          return res.status(200).json({label:scope.label,sourceReady:false,
            sourceError:'Nahrajte CSV export registrací. Pokud už byl nahraný, ověřte dostupnost databáze. Stávající odkazy lze stále zrušit.',
            teams:links.map(l=>({teamId:l.team_id,name:l.team_id,players:null})),links:links.map(safeLink)});
        }
      }
      const teamId = req.query?.teamId;
      if (!uuid(teamId)) return fail(400,'Vyberte platný tým.','team');
      if (action === 'revoke') {await store.revoke(scope,teamId.toLowerCase()); return res.status(200).json({revoked:true});}
      const {teams,source} = await getData(), team = teams.find(t => t.teamId === teamId.toLowerCase());
      if (!team) return fail(404,'Tým není v této soutěži a sezoně.','team');
      if (action === 'admin-team') {let shown=team;try{shown=await portraits(team,{env});}catch{}return res.status(200).json({label:scope.label,team:shown,source,readAt:new Date().toISOString()});}
      if (Date.now() >= Date.parse('2027-09-01T00:00:00Z')) return fail(409,'Sezona je uzavřená.','season_closed');
      const result = await store.rotate(scope,team.teamId);
      return res.status(201).json({path:'/registrations/team#'+result.token,link:safeLink(result.link)});
    } catch (error) {
      if(error instanceof RegistrationCsvError)return fail(400,error.message,'csv');
      if (error instanceof RegistrationSourceError && error.code === 'source_not_verified') return fail(503,
        'Registrace zatím nejsou připojené k ověřenému HMS API. Nejde o informaci o dluhu hráčů.','source_not_verified');
      // Never log upstream payloads, SQL, cookies, URLs, player data or credentials.
      return fail(503,'Registrace nelze bezpečně načíst. Ověřte datové připojení a databázi. Údaje o úhradách nejsou ověřené.','source_unavailable');
    }
  };
}
