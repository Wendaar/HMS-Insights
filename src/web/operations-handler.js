import {organizationEntry, publicOrganizations} from '../app/organizations.js';
import {hasBearerSecret} from '../security/bearer-secret.js';
import {readOperations} from '../app/operations.js';
import {HmsRequestError} from '../hms/client.js';
import {ScheduleSourceError} from '../app/season-games.js';
export function createOperationsHandler(options = {}) {
  return async (req, res) => {
    res.setHeader('cache-control', 'private, no-store'); res.setHeader('vary', 'Authorization');
    res.setHeader('x-content-type-options', 'nosniff'); res.setHeader('referrer-policy', 'no-referrer');
    const fail = (status, error, code, retryable = false) => res.status(status).json({error, code, retryable});
    if (req.method !== 'GET') { res.setHeader('allow', 'GET'); return fail(405, 'Pouze čtení.', 'method'); }
    const env = options.env ?? process.env;
    let org;
    try { org = organizationEntry(req.query?.org, env); } catch { return fail(404, 'Neznámá organizace.', 'organization'); }
    const secret = env[`HMS_${org.code}_OPERATIONS_SECRET`];
    if (req.query.action === 'access') return res.status(200).json({org: org.code, configured: !!secret,
      organizations: publicOrganizations(env).map(({code, slug, name}) => ({code, slug, name}))});
    if (!secret) return fail(503, 'Provozní přístup této organizace čeká na nastavení.', 'configuration');
    if (!hasBearerSecret({...req, headers: {authorization: req.headers?.authorization}}, secret)) return fail(401, 'Zadejte platný provozní kód organizace.', 'access');
    try { return res.status(200).json(await (options.read ?? readOperations)(req.query, options)); }
    catch (error) {
      if (error instanceof TypeError && /^(Vyberte |Neplatná stránka)/.test(error.message)) return fail(400, error.message, 'query');
      const rate = (error instanceof HmsRequestError || error instanceof ScheduleSourceError) && error.status === 429;
      const integrity = /scope|identity|[Dd]uplicate|Conflicting|invalid.*fixture/i.test(error.message);
      const timeout = ['TimeoutError', 'AbortError'].includes(error.name);
      const code = rate ? 'rate_limit' : integrity ? 'source_integrity' : timeout ? 'source_timeout' : 'source_unavailable';
      (options.reportFailure ?? console.warn)({event: 'operations_read_failed', code, organization: org.code,
        offset: Number.isSafeInteger(Number(req.query.offset)) ? Number(req.query.offset) : 0});
      if (rate) res.setHeader('retry-after', String(error.retryAfter ?? 30));
      return fail(rate ? 429 : 503, rate ? 'HMS dočasně omezuje počet požadavků. Načítání se zopakuje.' :
        integrity ? 'HMS vrátilo nekonzistentní údaje. Součty se nezobrazují; zkuste načítání zopakovat.' :
        'Spojení s HMS se dočasně přerušilo. Můžete pokračovat od poslední načtené stránky.', code, !integrity);
    }
  };
}
