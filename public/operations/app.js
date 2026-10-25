import {aggregate, periods, warningLabels, csv, staffRanking, paymentLabel, paidLabel} from './model.js';
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
let configured = false;
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
function download(rows, columns) {
  const link = el('a');
  link.href = URL.createObjectURL(new Blob([csv(rows, columns)], {type: 'text/csv;charset=utf-8'}));
  link.download = `hms-${$('org').value}-${view}-${range().from}-${range().to}${mode === 'demo' ? '-UKAZKA' : ''}.csv`;
  link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function panel(title, note) {
  const section = el('section', undefined, 'panel'), head = el('div', undefined, 'panel-head'), text = el('div');
  text.append(el('h2', title), el('p', note)); head.append(text); section.append(head);
  return section;
}
function table(title, note, rows, columns) {
  const section = panel(title, note), exportButton = el('button', 'Export CSV', 'secondary');
  const exportRows = rows.map(row => ({...row, checks: row.checks?.map(key => warningLabels[key]), payment: row.payment}));
  exportButton.disabled = !rows.length; exportButton.onclick = () => download(exportRows, columns); section.firstChild.append(exportButton);
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
    column.setAttribute('aria-label', column.title + '. Otevřít směny tohoto člověka.');
    column.append(el('b', row.total));
    for (const name of competitions) if (row.competitions[name]) {
      const segment = el('span', row.competitions[name], 'column-segment'); segment.style.height = (row.competitions[name] / max * 180) + 'px'; segment.style.backgroundColor = color(name); segment.title = name + ': ' + row.competitions[name]; bars.append(segment);
    }
    column.append(bars, el('span', row.name, 'person-name'));
    column.onclick = () => { $('search').value = row.name; navigate('staff'); };
    chart.append(column);
  }
  scroll.append(chart); section.append(scroll, el('p', 'Kliknutím na člověka otevřete jeho tabulku. Jedna směna = přiřazení člověka v jedné roli k jednomu zápasu.', 'legend'));
  return section;
}
function render() {
  for (const button of $('navigation').children) button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false');
  $('content').replaceChildren();
  if (!data) {
    const section = panel('Provozní přehledy HMS', 'Vyberte organizaci a načtěte její data.');
    section.append(el('div', configured ? 'Zadejte provozní kód organizace. Ukázka je k dispozici samostatně.' : 'Živý přístup této organizace čeká na nastavení. Ukázka je k dispozici samostatně.', 'empty'));
    $('content').append(section); return;
  }
  let model;
  try { model = aggregate(data.games, range(), {competition: $('competition').value, q: $('search').value, payment: $('payment').value, today}); }
  catch (error) { $('message').textContent = error.message; return; }
  const {games, staff, teams, cashIssues} = model, exceptions = games.filter(game => game.warnings.length);
  if (mode === 'demo') $('content').append(el('div', 'UKÁZKA · smyšlené zápasy, jména i úhrady. Pro skutečné podklady načtěte HMS.', 'notice'));
  const unknownTeams = games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.cash === null).length;
  const unknownPayments = games.flatMap(game => [game.home, game.away]).filter(team => team.id && team.cash === true && team.paid === null).length;
  if (mode === 'live' && (unknownTeams || unknownPayments)) $('content').append(el('div', `Dostupnost údajů: ${unknownTeams} týmových záznamů bez platebního režimu, ${unknownPayments} hotovostních týmových záznamů bez úhrady. Neznámé hodnoty jsou označené „K ověření“ nebo „API neuvádí“.`, 'notice'));
  if (view === 'dashboard') {
    const cards = el('div', undefined, 'cards');
    for (const [label, count, note, target, filter] of [
      ['Zápasy v období', games.length, 'Otevřít zápasy a Venue', 'games', ''],
      ['Chybějící personál', games.filter(game => game.warnings.some(warning => ['referee', 'timekeeper'].includes(warning))).length, 'Zápasy bez rozhodčího či časoměřiče', 'games', 'staff'],
      ['HOTOVĚ · úhrady ke kontrole', cashIssues.length, 'Konkrétní týmy v minulých zápasech', 'games', 'cash'],
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
    const section = panel('Měsíční uzávěrka · podklady pro Nikolu', `${range().from} – ${range().to}. Zkontrolujte výjimky a stáhněte podklady k fakturaci a směnám.`);
    const steps = el('div', undefined, 'closing-steps');
    for (const [number, title, note] of [
      ['1', 'Zkontrolovat hotovost', cashIssues.length + ' týmových úhrad ke kontrole v minulých zápasech.'],
      ['2', 'Připravit faktury', teams.filter(team => team.cash === false).length + ' řádků tým × soutěž v režimu FAKTURY.'],
      ['3', 'Připravit podklady ke mzdám', staff.filter(person => person.selected > 0).length + ' řádků člověk × role × soutěž ve vybraném období.']
    ]) { const step = el('div'); step.append(el('span', number, 'step-number'), el('h3', title), el('p', note)); steps.append(step); }
    section.append(steps, el('p', 'Jde o kontrolní a exportní podklady. Tato stránka nevystavuje faktury, nevyplácí mzdy a neoznačuje měsíc jako uzavřený. Zrušené zápasy se nepočítají.'));
    $('content').append(section,
      table('1 · HOTOVĚ bez PAID', 'Konkrétní tým, zápas a jeho vlastní stav úhrady. Budoucí zápasy jsou vynechané.', cashIssues, cashColumns),
      table('2 · Týmy pro fakturaci', 'Jen týmy s potvrzeným příznakem FAKTURY. Žádné počítadlo „CASH účastí“ ani „dokončených zápasů“.', teams.filter(team => team.cash === false), teamColumns),
      table('3 · Podklady ke mzdám', 'Pouze přiřazení ve vybraném období. Částky se doplní po nastavení sazeb.', staff.filter(person => person.selected > 0), [['name', 'Člověk'], ['role', 'Role'], ['competition', 'Soutěž'], ['selected', 'Počet směn']]));
    const other = games.filter(game => game.warnings.some(warning => !['cash', 'payment_unknown'].includes(warning)));
    if (other.length) $('content').append(table('Další údaje k ověření', 'Obsazení personálem, soupeři a dostupnost platebního režimu.', gameRows(other), gameColumns));
  }
}
function choices() {
  const value = $('competition').value, options = new Map(data.games.map(game => [game.competitionId || game.competition, game.competition]));
  $('competition').replaceChildren(new Option('Všechny soutěže', ''), ...[...options].map(([id, name]) => new Option(name, id)));
  if (options.has(value)) $('competition').value = value;
}
async function load() {
  try { periods(range().from, range().to); } catch (error) { $('message').textContent = error.message; return; }
  const id = ++requestId, org = $('org').value, requestedRange = range(), all = [], ids = new Set();
  data = null; render(); $('message').textContent = 'Načítám HMS · součty se zobrazí až po načtení celého období…';
  try {
    let offset = 0, result;
    do {
      const response = await fetch('/api/operations?' + new URLSearchParams({org, ...requestedRange, offset}), {headers: {authorization: 'Bearer ' + credential}, cache: 'no-store', signal: AbortSignal.timeout(28000)});
      result = await response.json(); if (id !== requestId) return;
      if (!response.ok) throw Error(result.error || 'Data nejsou dostupná.');
      if (result.organizationSlug !== org.toLowerCase() || result.offset !== offset || !Array.isArray(result.games)) throw Error('Zdroj nepotvrdil organizaci a stránkování dat.');
      for (const game of result.games) {
        const key = game.id.toLowerCase(); if (ids.has(key)) throw Error('HMS vrátilo duplicitní stránku. Neúplné součty se nezobrazují.');
        ids.add(key); all.push(game);
      }
      if (result.hasMore && (!Number.isSafeInteger(result.nextOffset) || result.nextOffset <= offset || result.nextOffset > 3000)) throw Error('Období je příliš velké. Zúžte rozsah.');
      offset = result.nextOffset; $('message').textContent = `Načítám HMS · ${all.length} zápasů včetně srovnávacích období…`;
    } while (result.hasMore);
    if (!result.complete) throw Error('HMS nepotvrdilo úplnost období.');
    data = {...result, games: all}; mode = 'live'; $('source').textContent = 'HMS API · živá data';
    $('message').textContent = `Načteno ${new Date(result.readAt).toLocaleString('cs-CZ')} · ${all.length} zápasů včetně srovnávacích období.`;
    $('lock').hidden = false; choices(); render();
  } catch (error) {
    if (id === requestId) { data = null; $('message').textContent = error.name === 'TimeoutError' ? 'Načítání trvá příliš dlouho. Zkuste užší období.' : error.message; render(); }
  }
}
async function access() {
  const id = ++requestId, org = $('org').value;
  credential = ''; $('secret').value = ''; data = null; mode = ''; configured = false;
  $('lock').hidden = true; $('competition').replaceChildren(new Option('Všechny soutěže', '')); $('payment').value = ''; $('search').value = '';
  $('map-link').href = '/control?' + new URLSearchParams({org}); history.replaceState(null, '', '?' + new URLSearchParams({org}));
  $('source').textContent = 'Přístup k provozním datům'; $('access-note').textContent = 'Živá data chrání provozní kód vaší organizace.'; $('message').textContent = ''; render();
  try {
    const response = await fetch('/api/operations?' + new URLSearchParams({org, action: 'access'})); const info = await response.json();
    if (id !== requestId) return; if (!response.ok) throw Error(info.error);
    for (const organization of info.organizations ?? []) if (![...$('org').options].some(option => option.value === organization.slug)) $('org').append(new Option(organization.name, organization.slug));
    configured = info.configured;
    $('access-note').textContent = configured ? 'Zadejte provozní kód organizace. Kód se drží jen v paměti a nikam se neukládá.' : 'Živý přístup čeká na nastavení pro tuto organizaci. K dispozici je ukázka.'; render();
  } catch (error) { if (id === requestId) $('message').textContent = error.message; }
}
$('unlock').onsubmit = event => { event.preventDefault(); credential = $('secret').value; $('secret').value = ''; load(); };
$('demo').onclick = () => {
  try {
    periods(range().from, range().to); ++requestId; credential = ''; $('secret').value = ''; data = demoData($('org').value, range()); mode = 'demo';
    $('source').textContent = 'UKÁZKA · smyšlená data'; $('lock').hidden = false; $('message').textContent = 'Ukázkový režim · nejde o skutečné údaje HMS.'; choices(); render();
  } catch (error) { $('message').textContent = error.message; }
};
$('lock').onclick = access; $('org').onchange = access;
$('filters').onsubmit = event => { event.preventDefault(); if (mode === 'demo') $('demo').click(); else if (credential) load(); else $('message').textContent = 'Nejdříve odemkněte data nebo otevřete ukázku.'; };
$('competition').onchange = render; $('payment').onchange = render; $('search').oninput = render;
for (const id of ['from', 'to']) $(id).onchange = () => { ++requestId; data = null; render(); $('message').textContent = 'Období změněno. Použijte období pro nové načtení.'; };
access();
