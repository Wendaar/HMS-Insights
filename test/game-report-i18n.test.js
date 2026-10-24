import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleAnalysis} from '../src/app/sample.js';
import {rowsFor} from '../src/infrastructure/analysis-rows.js';
import {buildGameSummary} from '../src/domain/game-summary.js';
import {renderGameReport} from '../src/web/game-report.js';
import {createGameReportHandler} from '../src/web/game-report-handler.js';
import {reportLanguage,reportText,reportHtml,protectedReportText} from '../public/game-report-i18n.js';
const rows=rowsFor(sampleAnalysis);
const summary=buildGameSummary({game:rows.games[0],teams:rows.team_game_stats,players:rows.player_game_stats,goalies:rows.goalie_game_stats,priklepy:rows.detected_priklepy});
const visible=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]*>/g,' ');
test('EUCHL defaults to English; explicit language wins and untrusted values are ignored',()=>{
  assert.equal(reportLanguage(null,{competition:'EUCHL'}),'en');
  assert.equal(reportLanguage(null,{competition:'European Union College Hockey League',group:'Division One'}),'en');
  assert.equal(reportLanguage('cs',{competition:'EUCHL'}),'cs');
  assert.equal(reportLanguage('en',{competition:'PHM Cup'}),'en');
  assert.equal(reportLanguage(['en'],{competition:'PHM Cup'}),'cs');
  assert.equal(reportLanguage('<script>',{competition:'EUCHL'}),'en');
});
test('English report translates server UI and achievements without changing the JSON or names',()=>{
  const before=JSON.stringify(summary),html=renderGameReport(summary,{lang:'en'}),text=visible(html);
  assert.match(html,/<html lang="en">/);
  for(const label of ['Game timeline','Special teams','Goal origins','Player scoring','Game scoring leaders','Big win','Player profile'.toUpperCase()])assert.ok(text.includes(label),label);
  assert.doesNotMatch(text,/Časová osa|Kanadské|vstřelil|zaznamenal|zákroků|body v zápase|zvítězilo/);
  assert.equal(JSON.stringify(summary),before);
  assert.deepEqual(JSON.parse(html.match(/id="game-report-data">([\s\S]*?)<\/script>/)[1]).summary,summary);
  for(const p of summary.players)assert.ok(html.includes(p.name));
  assert.match(html,/data-report-lang="en"[^>]*aria-current="true"/);
});
test('Czech stays the default outside EUCHL and can be selected explicitly for EUCHL',()=>{
  assert.match(renderGameReport(summary),/<html lang="cs">/);
  assert.match(renderGameReport({...summary,competition:'EUCHL'}),/<html lang="en">/);
  assert.match(renderGameReport({...summary,competition:'EUCHL'},{lang:'cs'}),/Časová osa zápasu/);
});
test('fragment translation covers event details, zone labels, ranks and filter updates',()=>{
  assert.equal(reportText('2. třetina · 5 na 4 · 19 událostí','en'),'Period 2 · 5 on 4 · 19 events');
  assert.equal(reportText('Mezi kruhy · Levá strana · Dorážka · Tečovaná střela','en'),'Between the circles · Left side · Rebound · Deflection');
  assert.equal(reportText('★ HVĚZDA ZÁPASU · HRÁČŮ V POLI · BRANKÁŘŮ','en'),'★ STAR OF THE GAME · SKATERS · GOALTENDERS');
  assert.equal(reportText('Neznámý vlastní popis','en'),'Neznámý vlastní popis');
  assert.equal(reportText('Hattrick','en'),'Hat trick');
  assert.equal(reportText('Výsledek 2 ku 8','en'),'Score 2 to 8');
  assert.equal(protectedReportText('Góly · HC Body · Jan Střed','en',['HC Body','Jan Střed']),'Goals · HC Body · Jan Střed');
});
test('HTML localization preserves script data, IDs, URLs, escaped names and markup safety',()=>{
  const input='<p title="Gól 1 · Jan Střed">Góly · HC &amp; Body</p><a href="?Góly=1" data-label="Góly">Góly</a><script type="application/json">{"Góly":"Body"}</script>';
  const result=reportHtml(input,'en',['Jan Střed','HC & Body']);
  assert.match(result,/title="Goal 1 · Jan Střed"/);
  assert.match(result,/Goals · HC &amp; Body/);
  assert.match(result,/href="\?Góly=1" data-label="Góly"/);
  assert.match(result,/\{"Góly":"Body"\}/);
  assert.equal(reportHtml(input,'cs'),input);
});
test('handler forwards language to HTML while public JSON remains language-neutral',async()=>{
  const call=async(json,lang)=>{let body;const response={setHeader(){},status(){return this;},send(v){body=v;},json(v){body=v;}};await createGameReportHandler({json,loadSummary:async()=>summary})({method:'GET',query:{gameId:summary.gameId,lang}},response);return body;};
  assert.match(await call(false,'en'),/<html lang="en">/);
  assert.deepEqual(await call(true,'en'),summary);
});
