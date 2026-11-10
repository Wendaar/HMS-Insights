const slug=value=>{
 const normalized=String(value??'').trim().toLowerCase();
 if(!/^[a-z0-9-]+$/.test(normalized))throw new TypeError('Invalid organization slug');
 return normalized;
};
const language=value=>value==='en'?'en':'cs';
const color=value=>/^#[a-f0-9]{6}$/i.test(value??'')?value.toLowerCase():null;
export function insightsAccent(org,value){return color(value)??(slug(org)==='phm'?'#087b91':'#dcff5c');}
export function insightsWidgetUrl(origin,org,lang='cs',accent=null){
 const base=new URL(String(origin));
 if(!['http:','https:'].includes(base.protocol))throw new TypeError('Invalid widget origin');
 const url=new URL(`/widgets/insights/${slug(org)}`,base);url.searchParams.set('lang',language(lang));if(accent)url.searchParams.set('accent',insightsAccent(org,accent));return url.toString();
}
export function insightsEmbedCode(origin,org,lang='cs',accent=null){
 const codeLang=language(lang),name=slug(org).toUpperCase();
 return `<iframe src="${insightsWidgetUrl(origin,org,codeLang,accent)}" title="${codeLang==='en'?'Latest highlights':'To nejlepší z ledu'} · ${name}" width="100%" height="720" loading="lazy" style="display:block;width:100%;max-width:100%;border:0" allow="fullscreen"></iframe>`;
}
