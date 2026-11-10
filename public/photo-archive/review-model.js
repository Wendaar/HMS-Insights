export function initialSelection(photo,review){
  if(review && review.status!=='pending')return [...new Set((review.players || []).map(p=>p.playerId))];
  return [...new Set((photo.suggestions || []).filter(s=>!s.tentative && s.candidates.length===1).map(s=>s.candidates[0].playerId))];
}
export function thumbnailState(photo,review){
  const count=review?.players?.length || 0,heads='👤'.repeat(Math.min(count,3));
  if(review?.status==='confirmed')return `✓ ${heads} Schváleno: ${count} · uzavřeno`;
  if(review?.status==='in_progress')return `◐ Vybráno: ${count} · rozpracováno`;
  if(review?.status==='rejected')return '✓ Bez přiřazení · uzavřeno';
  if(photo.analysis?.status==='processing')return 'AI právě zpracovává';
  if(photo.suggestions?.some(s=>s.candidates.length))return 'AI návrhy · k potvrzení';
  return photo.analysis?.status==='complete'?'AI hotovo · doplnit ručně':'Čeká na kontrolu';
}
