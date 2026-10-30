// No network transport is bundled until Ecomail's transactional contract and
// account configuration are verified. Test mode never sends to any address.
export function ecomailAdapter({mode='test',verifiedTransactionalTransport}={}) {
  return {async send(message){
    if(mode==='test')return {outcome:'simulated'};
    if(mode!=='production'||!verifiedTransactionalTransport)throw new Error('Ecomail transactional API not verified');
    // This capability is intentionally unavailable to the web handler/scheduler.
    return verifiedTransactionalTransport.send(message);
  }};
}
