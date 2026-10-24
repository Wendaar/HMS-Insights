// Canonical HMS identity. Keep product names separate from the supplied logo.
export const HMS_WEBSITE = 'https://www.heromanagementsystem.com/';
export function hmsBrand(label='', prefix='/', productHref=null) {
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<span class="hms-brand"><a class="hms-company" href="${HMS_WEBSITE}" target="_blank" rel="noopener noreferrer" aria-label="HMS · Hero Management System"><span class="hms-logo"><img src="${escape(prefix)}hms-logo.png" width="3508" height="3508" alt="HMS · Hero Management System"></span></a>${label?(productHref&&/^\/game-center(?:\?|$)/.test(productHref)?`<a class="hms-product" href="${escape(productHref)}">${escape(label)}</a>`:`<span class="hms-product">${escape(label)}</span>`):''}</span>`;
}
