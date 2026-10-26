// Actual character coverage from the supplied All-Stars font files, not a language guess.
const brandGlyphs={"Frontline": " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]_`abcdefghijklmnopqrstuvwxyz{|}¡¢£¥§¨©«®¯°´¶·¸»¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïñòóôõöøùúûüýþÿĀāĂăĄąĆćĊċČčĎďĐđĒēĖėĘęĚěĞğĠġĢģĦħĪīĮįİıĶķĹĺĻļĽľŁłŃńŅņŇňŊŋŌōŐőŒœŔŕŖŗŘřŚśŞşŠšŢţŤťŦŧŪūŮůŰűŲųŴŵŶŷŸŹźŻżŽžȘșȚțˆˇ˘˙˚˛˜˝ẀẁẂẃẄẅỲỳ–—‘’‚“”„•…‹›⁄€™", "Pantha": " !&,-.0123456789?@ABCDEFGHIJKLMNOPQRSTUVWXYZ", "Hitch Grotesk": "\r !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬®¯°±²³´¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćČčĎďĐđĒēĖėĘęĚěĢģĪīĮįıĲĳĶķĹĺĻļĽľŁłŃńŅņŇňŌōŐőŒœŔŕŖŗŘřŚśŞşŠšŢţŤťŪūŮůŰűŲųŴŵŶŷŸŹźŻżŽžƒȷˆˇ˘˙˚˛˜˝̧̨̦̀́̂̃̄̆̇̈̊̋̌̒μẀẁẂẃẄẅẞỲỳ–—‘’‚“”„†‡•…‰‹›⁄⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉€™−"};
export const fonts=['Barlow Condensed','Oswald','Roboto Condensed','Noto Sans','Noto Serif','Frontline','Pantha','Hitch Grotesk'];
export const brandFonts=Object.keys(brandGlyphs);
// Shared heading families for Media Studio and its social output consumers.
export function designTypography(design,body='Barlow Condensed'){
  return {headline:design==='pantha'?'Pantha':design==='crazy'?'Permanent Marker':design==='artistic'?'Noto Serif':'Anton',body};
}
export function fontForText(family,text=''){
  const supported=f=>!brandGlyphs[f]||[...String(text).normalize('NFC')].every(c=>brandGlyphs[f].includes(c));
  if(supported(family))return family;
  return supported('Hitch Grotesk')?'Hitch Grotesk':'Noto Sans';
}
export function fontSpec(family,size,text=''){
  const selected=fontForText(family,text);
  return `${['Frontline','Pantha'].includes(selected)?400:700} ${size}px "${selected}"`;
}
