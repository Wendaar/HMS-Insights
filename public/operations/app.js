import {operationsLoad, continueOperationsLoad} from './loading.js';
import {aggregate, periods, warningLabels, csv, staffRanking, paymentLabel, paidLabel, personAssignments} from './model.js';
import {saveSnapshot,readSnapshot,clearSnapshot} from './snapshot.js';
import {demoData} from './demo.js';
import {hmsBrand} from '../hms-brand.js';
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
$('brand').innerHTML = hmsBrand('OPERATIONS');
const views = {dashboard: 'Kontrolní přehled', games: 'Zápasy', staff: 'Směny a mzdy', teams: 'Fakturace týmů', closing: 'Měsíční uzávěrka'};
let view = 'dashboard', data = null, mode = '', credential = '', requestId = 0, issue = '', chartPeriod = 'selected', chartRole = '';
let configured = false, loadState = 'idle', loadError = '', pendingLoad = null;
let authenticated=false,dataLoadedAt=0;
const storage={getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)};
function remember(){
  if(mode!=='live'||!data||!authenticated)return;
  saveSnapshot(storage,$('org').value,{data,loadedAt:dataLoadedAt,range:range(),view,filters:{competition:$('competition').value,payment:$('payment').value,q:$('search').value},chartPeriod,chartRole});
}
const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
$('from').value = today.slice(0, 7) + '-01';
$('to').value = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).toISOString().slice(0, 10);
const initialOrg = new URLSearchParams(location.search).get('org') ?? 'phm';
if (![...$('org').options].some(option => option.value === initialOrg)) $('org').append(new Option(initialOrg.toUpperCase(), initialOrg));
$('org').value = initialOrg;
const range = () => ({from: $('from').value, to: $('to').value});
for (const [id, label] of Object.entries(views)) {
  const button = el('button', label);
  button.onclick = () => { view = id; issue = ''; render(); };
  button.dataset.view = id; $('navigation').append(button);
}
function select(label, entries, value, onChange) {
  const wrapper = el('label', label), menu = el('select');
  for (const [key, text] of entries) menu.append(new Option(text, key));
  menu.value = value; menu.onchange = () => onChange(menu.value); wrapper.append(menu);
  return wrapper;
}
function download(rows, columns, exportRange=range()) {
  const link = el('a');
  link.href = URL.createObjectURL(new Blob([csv(rows, columns)], {type: 'text/csv;charset=utf-8'}));
  link.download = `hms-${$('org').value}-${view}-${exportRange.from}-${exportRange.to}${mode === 'demo' ? '-UKAZKA' : ''}.csv`;
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function panel(title, note) {
  const section = el('section', undefined, 'panel'), head = el('div', undefined, 'panel-head'), text = el('div');
  text.append(el('h2', title), el('p', note)); head.append(text); section.append(head);
  return section;
}
function table(title, note, rows, columns, exportRange) {
  const section = panel(title, note), exportButton = el('button', 'Export CSV', 'secondary');
  const exportRows = rows.map(row => ({...row, checks: row.checks?.map(key => warningLabels[key]), payment: row.payment}));
  exportButton.disabled = !rows.length; exportButton.onclick = () => download(exportRows, columns,exportRange); section.firstChild.append(exportButton);
  if (!rows.length) { section.append(el('p', 'Pro tento filtr nejsou žádné záznamy.', 'empty')); return section; }
  const wrap = el('div', undefined, 'table-wrap'), grid = el('table'), head = el('thead'), headRow = el('tr'), body = el('tbody');
  let ordered = [...rows], ascending = true, sortKey = '';
  const draw = () => {
    body.replaceChildren();
    for (const row of ordered) {
      const tr = el('tr');
      for (const [key] of columns) {
        const td = el('td'), value = row[key];
        if (key === 'checks') {
          for (const warning of value ?? []) td.append(el('span', warningLabels[warning], 'tag'));
          if (!value?.length) td.append(el('span', 'Bez zjištěné výjimky', 'tag ok'));
        } else if (key === 'payment') td.append(el('span', value ?? 'K ověření', 'tag ' + (row.cash === false ? 'invoice' : row.cash === true ? 'cash' : '')));
        else td.textContent = Array.isArray(value) ? value.join(', ') : value === null || value === undefined || value === '' ? '—' : String(value);
        tr.append(td);
      }
      body.append(tr);
    }
  };
  for (const [key, label] of columns) {
    const th = el('th'), button = el('button', label + ' ↕', 'sort');
    button.onclick = () => {
      ascending = sortKey === key ? !ascending : true; sortKey = key;
      ordered.sort((a, b) => typeof a[key] === 'number' && typeof b[key] === 'number' ? (a[key] - b[key]) * (ascending ? 1 : -1) : String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'cs', {numeric: true}) * (ascending ? 1 : -1));
      for (const cell of headRow.children) cell.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending'); draw();
    };
    th.append(button); headRow.append(th);
  }
  head.append(headRow); grid.append(head, body); draw(); wrap.append(grid); section.append(wrap);
  return section;
}
const gameColumns = [['date', 'Datum'], ['time', 'Čas'], ['venue', 'Venue'], ['match', 'Zápas'], ['competition', 'Soutěž'], ['homeBilling', 'Domácí · režim'], ['homePaid', 'Payment Host'], ['awayBilling', 'Hosté · režim'], ['awayPaid', 'Payment Guest'], ['referees', 'Rozhodčí'], ['timekeepers', 'Časoměřič'], ['checks', 'Ke kontrole']];
const staffColumns = [['name', 'Člověk'], ['role', 'Role'], ['competition', 'Soutěž'], ['previous', 'Předchozí období'], ['selected', 'Vybrané období'], ['next', 'Následující období']];
const teamColumns = [['team', 'Tým'], ['competition', 'Soutěž'], ['games', 'Počet zápasů'], ['payment', 'Platební režim']];
const cashColumns = [['team', 'Tým bez potvrzené úhrady'], ['date', 'Datum'], ['time', 'Čas'], ['venue', 'Venue'], ['opponent', 'Soupeř'], ['competition', 'Soutěž'], ['payment', 'Úhrada týmu']];
function gameRows(games) {
  return games.map(game => ({...game, match: (game.home.name || 'Chybí domácí') + ' — ' + (game.away.name || 'Chybí hosté'),
    homeBilling: paymentLabel(game.home.cash), awayBilling: paymentLabel(game.away.cash), homePaid: paidLabel(game.home.paid), awayPaid: paidLabel(game.away.paid), checks: game.warnings}));
}
function navigate(target, filter = '') { view = target; issue = filter; render(); }
const detail=el('dialog',undefined,'person-detail');
detail.setAttribute('aria-label','Konkrétní směny člověka');document.body.append(detail);
function openPerson(name,period,role){
  const rows=personAssignments(data.games,period,{name,role,competition:$('competition').value,payment:$('payment').value,q:$('search').value,today});
  const close=el('button','Zavřít detail','secondary');close.onclick=()=>detail.close();
  const header=el('div',undefined,'panel-head');header.append(el('h2','Směny · '+name),close);
  detail.replaceChildren(header,el('p',`${period.from} – ${period.to} · ${rows.length} konkrétních směn · ${role||'všechny role'}. Filtry hlavního přehledu se nemění.`),
    table('Zápasy a role','Každý řádek odpovídá jedné směně v grafu.',rows,[['date','Datum'],['time','Čas'],['venue','Venue'],['match','Zápas'],['competition','Soutěž'],['role','Role']],period));
  detail.showModal();
}
const colors = ['#2864db', '#20a987', '#e6a32e', '#9a6bd0', '#df6e89', '#37a3c4', '#a68d42', '#738394'];
function peopleChart(model) {
  const window = model.windows[chartPeriod], rows = staffRanking(model.staff, chartPeriod, chartRole);
  const section = panel('Směny podle lidí', `${window.from} – ${window.to} · od nejvíce obsazených. Barvy rozlišují soutěže.`);
  const controls = el('div', undefined, 'chart-controls');
  controls.append(select('Období grafu', [['previous', 'Předchozí období'], ['selected', 'Vybrané období'], ['next', 'Následující období']], chartPeriod, value => { chartPeriod = value; render(); }),
    select('Role v grafu', [['', 'Všechny role'], ['Rozhodčí', 'Rozhodčí'], ['Časoměřič', 'Časoměřiči']], chartRole, value => { chartRole = value; render(); }));
  section.append(controls);
  const competitions = [...new Set(data.games.map(game => game.competition))].sort((a, b) => a.localeCompare(b, 'cs'));
  const color = name => colors[competitions.indexOf(name) % colors.length];
  const legend = el('div', undefined, 'chart-legend');
  for (const name of competitions.filter(name => rows.some(row => row.competitions[name]))) {
    const label = el('span', undefined, 'legend-item'), dot = el('i'); dot.style.backgroundColor = color(name); label.append(dot, el('span', name)); legend.append(label);
  }
  section.append(legend);
  if (!rows.length) { section.append(el('p', 'V tomto období nejsou obsazené směny pro vybrané filtry.', 'empty')); return section; }
  const scroll = el('div', undefined, 'chart-scroll'), chart = el('div', undefined, 'people-chart'), max = rows[0].total;
  chart.setAttribute('aria-label', 'Počet směn jednotlivých lidí podle soutěží');
  for (const row of rows) {
    const column = el('button', undefined, 'person-column'), bars = el('span', undefined, 'column-bars');
    column.title = row.name + ': ' + row.total + ' směn. ' + Object.entries(row.competitions).map(([name, count]) => name + ': ' + count).join('; ');
    column.setAttribute('aria-label', column.title + '. Zobrazit konkrétní zápasy a role.');column.setAttribute('aria-haspopup','dialog');
    column.append(el('b', row.total));
    for (const name of competitions) if (row.competitions[name]) {
      const segment = el('span', row.competitions[name], 'column-segment'); segment.style.height = (row.competitions[name] / max * 180) + 'px'; segment.style.backgroundColor = color(name); segment.title = name + ': ' + row.competitions[name]; bars.append(segment);
    }
    column.append(bars, el('span', row.name, 'person-name'));
    column.onclick = () => openPerson(row.name,window,chartRole);
    chart.append(column);
  }
  scroll.append(chart); section.append(scroll, el('p', 'Kliknutím na sloupec otevřete konkrétní zápasy, časy, Venue a role daného člověka. Jedna směna = člověk v jedné roli u jednoho zápasu.', 'legend'));
  return section;
}
function render() {
  remember();
  for (const button of $('navigation').children) button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
  $('content').replaceChildren();
  if (!data) {
    if ((credential||authenticated) && ['loading', 'error'].includes(loadState)) {
      const count = pendingLoad?.games.length ?? 0;
      const section = panel(loadState === 'loading' ? 'Načítám provozní údaje HMS' : 'Načítání se přerušilo',
        count ? `Zachováno ${count} zápasů z dokončených stránek. Součty se zobrazí po načtení celého období.` : loadState === 'loading' ? 'Načítám vybrané období a podklady ke srovnání.' : 'První stránku se nepodařilo dokončit. Načítání můžete zopakovat.');
      section.append(el('p', loadState === 'error' ? loadError : 'Stránku můžete ponechat otevřenou. Případný krátký výpadek se automaticky zopakuje.'));
      if (loadState === 'error') {
        const retry = el('button', 'Pokračovat v načítání'); retry.onclick = () => load(true); section.append(retry);
      }
      $('content').append(section); return;
    }
    const section = panel('Provozní přehledy HMS', 'Vyberte organizaci a načtěte její data.');
    section.append(el('div', configured ? 'Zadejte provozní kód organizace. Ukázka je k dispozici samostatně.' : 'Živý přístup této organizace čeká na nastavení. Ukázka je k dispozici samostatně.', 'empty'));
    $('content').append(section); return;
  }
  let model;
  try { model = aggregate(data.games, range(), {competition: $('competition').value, q: $('search').value, payment: $('payment').value, today}); }
  catch (error) { $('message').textContent = error.message; return; }
  const {games, staff, teams, cashIssues} = model, exceptions = games.filter(game => game.warnings.length);
  if (mode === 'demo') $('content').append(el('div', 'UKÁZKA · smyšlené zápasy, jména i úhrady. Pro skutečné podklady načtěte HMS.', 'notice'));
  const unknownTeams = new Set(games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.cash === null).map(team=>team.id)).size;
  const unknownPayments = games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.cash === true && team.paid === null).length;
  if (mode === 'live' && (unknownTeams || unknownPayments)) $('content').append(el('div', `Platební údaje zatím nejsou úplně připojené z HMS. U ${unknownTeams} různých týmů API neposkytlo External Id; u ${unknownPayments} hotovostních týmových účastí neposkytlo úhradu. Vyplněné údaje v HMS není potřeba opravovat. Nejde o zjištěné chyby týmů.`, 'notice'));
  if (view === 'dashboard') {
    const cards = el('div', undefined, 'cards');
    for (const [label, count, note, target, filter] of [
      ['Zápasy v období', games.length, 'Otevřít zápasy a Venue', 'games', ''],
      ['Chybějící personál', games.filter(game => game.warnings.some(warning => ['referee', 'timekeeper'].includes(warning))).length, 'Zápasy bez rozhodčího či časoměřiče', 'games', 'staff'],
      ['HOTOVĚ · úhrady ke kontrole', unknownTeams || unknownPayments ? (cashIssues.length ? cashIssues.length + '+' : 'Neověřeno') : cashIssues.length, 'Konkrétní týmy v minulých zápasech', 'games', 'cash'],
      ['Potenciálně volný led', games.filter(game => game.warnings.includes('ice')).length, 'Dnešní a budoucí zápasy bez soupeřů', 'games', 'ice']
    ]) {
      const card = el('button', undefined, 'card'); card.append(el('small', label), el('b', count), el('p', note)); card.onclick = () => navigate(target, filter); cards.append(card);
    }
    $('content').append(cards, peopleChart(model));
    if (cashIssues.length) $('content').append(table('HOTOVĚ bez PAID · konkrétní týmy', 'Pouze minulé zápasy. Každý tým se kontroluje proti své vlastní úhradě.', cashIssues, cashColumns));
    $('content').append(table('Co je potřeba zkontrolovat', 'Chybějící obsazení, soupeři nebo údaje pro vybrané období.', gameRows(exceptions), gameColumns));
  } else if (view === 'games') {
    $('content').append(select('Zobrazení zápasů', [['', 'Všechny zápasy'], ['staff', 'Chybějící personál'], ['cash', 'HOTOVĚ bez PAID · konkrétní týmy'], ['ice', 'Potenciálně volný led'], ['unknown', 'Neúplné údaje'], ['any', 'Vše ke kontrole']], issue, value => { issue = value; render(); }));
    if (issue === 'cash') $('content').append(table('HOTOVĚ bez PAID · konkrétní týmy', 'Úhrada domácích a hostů se posuzuje zvlášť. Budoucí zápasy zde nejsou.', cashIssues, cashColumns));
    else {
      const allowed = {staff: ['referee', 'timekeeper'], ice: ['ice'], unknown: ['staff_unknown', 'cash_unknown', 'payment_unknown', 'teams_unknown', 'competition_unknown']};
      const rows = games.filter(game => !issue || issue === 'any' && game.warnings.length || game.warnings.some(warning => allowed[issue]?.includes(warning)));
      $('content').append(table('Zápasy', 'Venue, personál a obě týmové úhrady. Kliknutím na název sloupce seřadíte tabulku.', gameRows(rows), gameColumns));
    }
  } else if (view === 'staff') {
    $('content').append(peopleChart(model), table('Směny rozhodčích a časoměřičů', `Počty přiřazení po lidech, rolích a soutěžích. Předchozí: ${model.windows.previous.from} – ${model.windows.previous.to}. Následující: ${model.windows.next.from} – ${model.windows.next.to}. Mzdové sazby zatím nejsou nastavené.`, staff, staffColumns));
  } else if (view === 'teams') {
    $('content').append(table('Fakturace týmů', 'Počet zápasů po týmech a soutěžích. Platební režim čteme z External ID týmu; filtrem FAKTURY oddělíte týmy pro fakturaci od HOTOVĚ.', teams, teamColumns));
  } else {
    const section = panel('Měsíční uzávěrka · fakturace a mzdy', `${range().from} – ${range().to}. Zkontrolujte výjimky a stáhněte podklady k fakturaci a směnám.`);
    const steps = el('div', undefined, 'closing-steps');
    for (const [number, title, note] of [
      ['1', 'Zkontrolovat hotovost', unknownTeams || unknownPayments ? 'Kontrola není úplná: některé platební údaje nejsou dostupné.' : cashIssues.length + ' týmových úhrad ke kontrole v minulých zápasech.'],
      ['2', 'Připravit faktury', teams.filter(team => team.cash === false).length + ' týmových podkladů podle soutěží v režimu FAKTURY.'],
      ['3', 'Připravit podklady ke mzdám', staff.filter(person => person.selected > 0).length + ' personálních podkladů podle rolí a soutěží ve vybraném období.']
    ]) { const step = el('div'); step.append(el('span', number, 'step-number'), el('h3', title), el('p', note)); steps.append(step); }
    section.append(steps, el('p', 'Jde o kontrolní a exportní podklady. Tato stránka nevystavuje faktury, nevyplácí mzdy a neoznačuje měsíc jako uzavřený. Zrušené zápasy se nepočítají.'));
    $('content').append(section,
      table('1 · HOTOVĚ bez PAID', 'Konkrétní tým, zápas a jeho vlastní stav úhrady. Budoucí zápasy jsou vynechané.', cashIssues, cashColumns),
      table('2 · Týmy pro fakturaci', 'Počty zápasů k fakturaci podle týmů a soutěží. Jen týmy s potvrzeným režimem FAKTURY.', teams.filter(team => team.cash === false), teamColumns),
      table('3 · Podklady ke mzdám', 'Pouze přiřazení ve vybraném období. Částky se doplní po nastavení sazeb.', staff.filter(person => person.selected > 0), [['name', 'Člověk'], ['role', 'Role'], ['competition', 'Soutěž'], ['selected', 'Počet směn']]));
    const other = games.filter(game => game.warnings.some(warning => !['cash', 'payment_unknown'].includes(warning)));
    if (other.length) $('content').append(table('Další údaje k ověření', 'Obsazení personálem, soupeři a dostupnost platebního režimu.', gameRows(other), gameColumns));
  }
}
function choices() {
  const value = $('competition').value, options = new Map(data.games.map(game => [game.competitionId || game.competition, game.competition]));
  $('competition').replaceChildren(new Option('Všechny soutěže', ''), ...[...options].map(([id, name]) => new Option(name, id)));
  if (options.has(value)) $('competition').value = value;
  const billingAvailable=data.games.some(game=>[game.home,game.away].some(team=>team.id&&team.cash!==null));
  for(const option of $('payment').options)if(['cash','invoice'].includes(option.value)){option.disabled=!billingAvailable;option.title=billingAvailable?'':'Platební režimy se zatím z HMS nepřenášejí.';}
  if([...$('payment').options].find(option=>option.value===$('payment').value)?.disabled)$('payment').value='';
}
async function load(resume = false) {
  try { periods(range().from, range().to); } catch (error) { $('message').textContent = error.message; return; }
  if (!credential&&!authenticated) { $('message').textContent = 'Zadejte provozní kód organizace.'; return; }
  const id = ++requestId, org = $('org').value, requestedRange = range(), requestCredential = credential;
  if (!resume || !pendingLoad || pendingLoad.org !== org || pendingLoad.range.from !== requestedRange.from || pendingLoad.range.to !== requestedRange.to) pendingLoad = operationsLoad(org, requestedRange);
  const state = pendingLoad;
  data = null; loadState = 'loading'; loadError = ''; $('lock').hidden = false; render();
  $('source').textContent = 'HMS · načítání dat';
  $('access-note').textContent = 'Při přerušení lze pokračovat bez opětovného zadávání kódu.';
  $('message').textContent = 'Načítám úplný přehled HMS…';
  try {
    const done = await continueOperationsLoad(state, {
      current: () => id === requestId,
      progress: (count, delay) => { if (id === requestId) $('message').textContent = delay ? 'HMS je dočasně vytížené. Opakuji stránku za ' + Math.ceil(delay / 1000) + ' s · načteno ' + count + ' zápasů.' : 'Načítám HMS · ' + count + ' zápasů včetně srovnávacích období…'; },
      readPage: async offset => {
        let response;
        try { response = await fetch('/api/operations?' + new URLSearchParams({org, ...requestedRange, offset}), {headers: requestCredential?{authorization:'Bearer '+requestCredential}:{}, cache: 'no-store', signal: AbortSignal.timeout(28000)}); }
        catch (cause) { const error = Error('Spojení s HMS se přerušilo.'); error.retryable = true; throw error; }
        let result;
        try { result = await response.json(); } catch { const error = Error('HMS nevrátilo datovou odpověď.'); error.retryable = response.status >= 500; throw error; }
        if (!response.ok) { const error = Error(result.error || 'Data nejsou dostupná.'); error.status = response.status; error.retryable = result.retryable ?? [429, 502, 503, 504].includes(response.status); error.retryAfter = Number(response.headers.get('retry-after')); throw error; }
        return result;
      }
    });
    if (!done || id !== requestId) return;
    data = {...state.last, games: state.games}; dataLoadedAt=Date.now(); mode = 'live'; loadState = 'ready'; pendingLoad = null;
    $('source').textContent = 'HMS API · živá data';
    $('message').textContent = 'Načteno ' + new Date(data.readAt).toLocaleString('cs-CZ') + ' · ' + data.games.length + ' zápasů včetně srovnávacích období.';
    $('access-note').textContent = 'Živá data jsou odemčená pro tuto organizaci.'; choices(); render();
  } catch (error) {
    if (id !== requestId) return;
    data = null; loadState = 'error'; loadError = error.message;
    if (error.status === 401) { authenticated=false;clearSnapshot(storage,org);credential = ''; pendingLoad = null; loadState = 'idle'; }
    $('message').textContent = error.message;
    if (credential||authenticated) { $('source').textContent = 'HMS · načítání přerušeno'; $('access-note').textContent = 'Kód zůstává v paměti. Načtené stránky lze zachovat a pokračovat.'; }
    render();
  }
}
async function access() {
  const id=++requestId,org=$('org').value;
  credential='';authenticated=false;$('secret').value='';data=null;mode='';configured=false;loadState='idle';loadError='';pendingLoad=null;
  if(detail.open)detail.close();
  $('lock').hidden=true;$('competition').replaceChildren(new Option('Všechny soutěže',''));$('payment').value='';$('search').value='';
  $('map-link').href='/control?'+new URLSearchParams({org});history.replaceState(null,'','?'+new URLSearchParams({org}));
  $('source').textContent='Přístup k provozním datům';$('access-note').textContent='Ověřuji uložené přihlášení…';$('message').textContent='';render();
  try{
    const response=await fetch('/api/operations?'+new URLSearchParams({org,action:'access'}),{cache:'no-store'});const info=await response.json();
    if(id!==requestId)return;if(!response.ok)throw Error(info.error);
    for(const organization of info.organizations??[])if(![...$('org').options].some(option=>option.value===organization.slug))$('org').append(new Option(organization.name,organization.slug));
    configured=info.configured;authenticated=info.authorized===true;
    $('access-note').textContent=authenticated?'Přihlášení je zapamatované. Zamknutím jej ukončíte.':configured?'Zadejte provozní kód. Přihlášení zůstane platné 8 hodin; samotný kód neukládáme.':'Živý přístup čeká na nastavení pro tuto organizaci. K dispozici je ukázka.';
    if(!authenticated){clearSnapshot(storage,org);render();return;}
    $('lock').hidden=false;
    const saved=readSnapshot(storage,org);
    if(saved){
      data=saved.data;dataLoadedAt=saved.loadedAt;mode='live';loadState='ready';
      $('from').value=saved.range.from;$('to').value=saved.range.to;
      view=Object.hasOwn(views,saved.view)?saved.view:'dashboard';chartPeriod=['previous','selected','next'].includes(saved.chartPeriod)?saved.chartPeriod:'selected';chartRole=['','Rozhodčí','Časoměřič'].includes(saved.chartRole)?saved.chartRole:'';
      choices();if([...$('competition').options].some(option=>option.value===saved.filters?.competition))$('competition').value=saved.filters.competition;
      if(['','invoice','cash','unknown'].includes(saved.filters?.payment)&&![...$('payment').options].find(option=>option.value===saved.filters.payment)?.disabled)$('payment').value=saved.filters.payment;
      $('search').value=typeof saved.filters?.q==='string'?saved.filters.q.slice(0,160):'';
      $('source').textContent='HMS · obnovený přehled';$('message').textContent='Přehled obnoven bez nového načítání. Data z '+new Date(data.readAt).toLocaleString('cs-CZ')+'. Tlačítkem Použít období načtete aktuální HMS.';
      render();
    }else await load();
  }catch(error){if(id===requestId)$('message').textContent=error.message;}
}
async function unlock(event){
  event.preventDefault();const supplied=$('secret').value;$('secret').value='';
  if(!supplied&&!authenticated&&!credential){$('message').textContent='Zadejte provozní kód organizace.';return;}
  if(supplied){
    const org=$('org').value,id=++requestId;
    try{
      const response=await fetch('/api/operations?'+new URLSearchParams({org,action:'session'}),{method:'POST',headers:{authorization:'Bearer '+supplied},cache:'no-store'});
      const result=await response.json();if(id!==requestId)return;if(!response.ok)throw Error(result.error||'Přístup se nepodařilo ověřit.');
      authenticated=result.authorized===true;credential='';
    }catch(error){$('message').textContent=error.message;return;}
  }
  await load(!!pendingLoad);
}
async function lock(){
  const org=$('org').value;++requestId;clearSnapshot(storage,org);credential='';authenticated=false;data=null;pendingLoad=null;loadState='idle';mode='';if(detail.open)detail.close();render();
  try{
    const response=await fetch('/api/operations?'+new URLSearchParams({org,action:'logout'}),{method:'POST',cache:'no-store'});
    if(!response.ok)throw Error();await access();
  }catch{$('message').textContent='Data jsou skrytá. Spojení se přerušilo; odhlášení prosím zopakujte.';}
}
$('unlock').onsubmit=unlock;
$('demo').onclick = () => {
  try {
    periods(range().from, range().to); ++requestId; pendingLoad = null; loadState = 'idle'; credential = ''; $('secret').value = ''; data = demoData($('org').value, range()); mode = 'demo';
    $('source').textContent = 'UKÁZKA · smyšlená data'; $('lock').hidden = false; $('message').textContent = 'Ukázkový režim · nejde o skutečné údaje HMS.'; choices(); render();
  } catch (error) { $('message').textContent = error.message; }
};
$('lock').onclick = lock; $('org').onchange = access;
$('filters').onsubmit = event => { event.preventDefault(); if (mode === 'demo') $('demo').click(); else if (credential||authenticated) load(); else $('message').textContent = 'Nejdříve odemkněte data nebo otevřete ukázku.'; };
$('competition').onchange = render; $('payment').onchange = render; $('search').oninput = render;
for (const id of ['from', 'to']) $(id).onchange = () => { ++requestId; data = null; pendingLoad = null; loadState = 'idle'; render(); $('message').textContent = 'Období změněno. Použijte období pro nové načtení.'; };
access();
