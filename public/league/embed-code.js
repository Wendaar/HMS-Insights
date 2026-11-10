const slug=value=>{
 const normalized=String(value??'').trim().toLowerCase();
 if(!/^[a-z0-9-]+$/.test(normalized))throw new TypeError('Invalid organization slug');
 return normalized;
};
const language=value=>value==='en'?'en':'cs';
export function insightsWidgetUrl(origin,org,lang='cs'){
 const base=new URL(String(origin));
 if(!['http:','https:'].includes(base.protocol))throw new TypeError('Invalid widget origin');
 return new URL(`/widgets/insights/${slug(org)}?lang=${language(lang)}`,base).toString();
}
export function insightsEmbedCode(origin,org,lang='cs'){
 const codeLang=language(lang),name=slug(org).toUpperCase();
 return `<iframe src="${insightsWidgetUrl(origin,org,codeLang)}" title="${codeLang==='en'?'Latest highlights':'To nejlepší z ledu'} · ${name}" width="100%" height="720" loading="lazy" style="display:block;width:100%;max-width:100%;border:0" allow="fullscreen"></iframe>`;
}
