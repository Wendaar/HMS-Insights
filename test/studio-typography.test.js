import test from 'node:test';
import assert from 'node:assert/strict';
import {fonts,fontForText,fontSpec} from '../public/studio/typography.js';
test('brand fonts use actual supported characters and preserve Czech names via a complete-font fallback',()=>{
  for(const f of ['Frontline','Hitch Grotesk']){assert.ok(fonts.includes(f));assert.equal(fontForText(f,'Příliš žluťoučký kůň – Matěj Kuracina'),f);}
  assert.equal(fontForText('Pantha','HATTRICK HERO 123'),'Pantha');
  assert.equal(fontForText('Pantha','MATĚJ KURACINA'),'Hitch Grotesk');
  assert.equal(fontForText('Pantha','Matěj Kuracina'),'Hitch Grotesk');
  assert.equal(fontForText('Pantha','1:1'),'Hitch Grotesk');
  assert.equal(fontForText('Frontline','Игрок'),'Noto Sans');
  assert.equal(fontSpec('Pantha',80,'HERO'),'400 80px "Pantha"');
  assert.equal(fontSpec('Pantha',40,'ČEŠTINA'),'700 40px "Hitch Grotesk"');
});
