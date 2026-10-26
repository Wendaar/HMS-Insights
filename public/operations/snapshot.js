import {periods} from './model.js';
const prefix = 'hms-operations-snapshot-v1:';
export const SNAPSHOT_TTL = 10 * 60 * 1000;
export function saveSnapshot(storage, org, snapshot, now = Date.now()) {
  if (!snapshot.data?.complete || snapshot.data.organizationSlug !== org.toLowerCase()) return false;
  const {data,loadedAt,range,view,filters,chartPeriod,chartRole}=snapshot;
  try { storage.setItem(prefix + org.toLowerCase(), JSON.stringify({v:1,data,loadedAt,range,view,filters,chartPeriod,chartRole})); return true; } catch { return false; }
}
export function readSnapshot(storage, org, now = Date.now()) {
  try {
    const raw = storage.getItem(prefix + org.toLowerCase());
    if (!raw || raw.length > 5 * 1024 * 1024) return null;
    const snapshot = JSON.parse(raw);
    if (snapshot.v !== 1 || !Number.isFinite(snapshot.loadedAt) || now - snapshot.loadedAt > SNAPSHOT_TTL || snapshot.loadedAt > now + 1000 || !snapshot.data?.complete || snapshot.data.organizationSlug !== org.toLowerCase()) return null;
    periods(snapshot.range?.from, snapshot.range?.to);
    if (!Array.isArray(snapshot.data.games) || snapshot.data.games.length > 3000 || snapshot.data.games.some(game => !game || typeof game.id !== 'string' || !game.home || !game.away || !(game.referees===null||Array.isArray(game.referees)) || !(game.timekeepers===null||Array.isArray(game.timekeepers)))) return null;
    return snapshot;
  } catch { return null; }
}
export function clearSnapshot(storage, org) { try { storage.removeItem(prefix + org.toLowerCase()); } catch {} }
