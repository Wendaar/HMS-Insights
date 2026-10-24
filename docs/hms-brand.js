// Canonical HMS identity. Keep product names separate from the supplied logo.
export const HMS_WEBSITE = 'https://www.heromanagementsystem.com/';
export function hmsBrand(label='', prefix='/') {
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<a class="hms-brand" href="${HMS_WEBSITE}" target="_blank" rel="noopener noreferrer" aria-label="HMS · Hero Management System"><span class="hms-logo"><img src="${escape(prefix)}hms-logo.png" width="3508" height="3508" alt="HMS · Hero Management System"></span>${label?`<span class="hms-product">${escape(label)}</span>`:''}</a>`;
}
