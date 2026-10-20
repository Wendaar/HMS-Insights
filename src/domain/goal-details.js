const clean = (value) => typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
const key = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Zones and their order follow the public HMS event editor. These are categories,
// not measured coordinates; no point location is inferred inside a zone.
export const SHOT_ZONES = [
  ["left-corner", "Left corner", "Levý roh"], ["behind-net", "Behind net", "Za brankou"], ["right-corner", "Right corner", "Pravý roh"],
  ["left-circle", "Left circle", "Levý kruh"], ["between-circles", "Between the circles", "Mezi kruhy"], ["right-circle", "Right circle", "Pravý kruh"],
  ["left-blue-line", "Left blue line", "Levá modrá"], ["center-blue-line", "Center blue line", "Střed modré"], ["right-blue-line", "Right blue line", "Pravá modrá"],
  ["left-central-zone", "Left central zone", "Levý střed"], ["center-central-zone", "Center central zone", "Střední pásmo"], ["right-central-zone", "Right central zone", "Pravý střed"],
  ["left-defensive-zone", "Left defensive zone", "Vlevo v obraně"], ["center-defensive-zone", "Center defensive zone", "Střed obrany"], ["right-defensive-zone", "Right defensive zone", "Vpravo v obraně"],
].map(([code, name, label]) => ({ code, name, label }));
export const NET_ZONES = [
  ["left-top-corner", "Left top corner", "Vlevo nahoře"], ["top-shelf", "Top shelf", "Pod víko"], ["right-top-corner", "Right top corner", "Vpravo nahoře"],
  ["left-side", "Left side", "Levá strana"], ["middle", "Middle", "Střed"], ["right-side", "Right side", "Pravá strana"],
  ["left-bottom-corner", "Left bottom corner", "Vlevo dole"], ["five-hole", "Five hole", "Mezi betony"], ["right-bottom-corner", "Right bottom corner", "Vpravo dole"],
].map(([code, name, label]) => ({ code, name, label }));

function reference(event, entity, idField) {
  const nested = event?.[entity];
  const name = clean(nested?.name);
  const code = clean(nested?.code);
  const id = clean(event?.[idField] ?? nested?.[idField]);
  return id || name || code ? { id: id?.toLowerCase() ?? null, name, code } : null;
}

export function publicReference(value) {
  if (!value || typeof value !== "object") return null;
  return { id: clean(value.id), name: clean(value.name), code: clean(value.code) };
}

function zone(value, catalog) {
  const ref = publicReference(value);
  const match = catalog.find((item) => [item.name, item.code, item.label].some((candidate) => [ref?.name, ref?.code].some((v) => v && key(v) === key(candidate))));
  return { id: ref?.id ?? null, code: match?.code ?? null, label: match?.label ?? null, sourceName: ref?.name ?? null };
}

export function goalDetails(event) {
  return {
    shotType: reference(event, "ListShotType", "listShotTypeId"),
    goalType: reference(event, "ListGoalType", "listGoalTypeId"),
    goalSubtype: reference(event, "ListGoalSubtype", "listGoalSubtypeId"),
    shotZone: reference(event, "ListEventLocation", "listEventLocationId"),
    netZone: reference(event, "ListGoalLocation", "listGoalLocationId"),
  };
}

export function publicGoalDetails(details) {
  return {
    shotType: publicReference(details?.shotType), goalType: publicReference(details?.goalType),
    goalSubtype: publicReference(details?.goalSubtype),
    shotZone: zone(details?.shotZone, SHOT_ZONES), netZone: zone(details?.netZone, NET_ZONES),
  };
}

export function penaltyDetails(event) {
  return { type: reference(event, "ListPenaltyType", "listPenaltyTypeId"), subtype: reference(event, "ListPenaltySubtype", "listPenaltySubtypeId") };
}

export function recordedSituation(event) {
  const label = clean(event.details?.goalType?.name);
  const type = key(label);
  const numbers = /([3-6])\s*(?:on|na|v|vs|x|:)\s*([3-6])/i.exec(label ?? '');
  const manpower = numbers ? { for: Number(numbers[1]), against: Number(numbers[2]) } : null;
  if (manpower) return { code: manpower.for > manpower.against ? 'PP' : manpower.for < manpower.against ? 'SH' : 'EV', source: 'hms', label, manpower };
  if (/powerplay|presilov/.test(type)) return { code: "PP", source: "hms", label };
  if (/shorthanded|oslabeni/.test(type)) return { code: "SH", source: "hms", label };
  if (/evenstrength|rovnovaz/.test(type)) return { code: "EV", source: "hms", label };
  if (label) return { code: "OTHER", source: "hms", label };
  return { code: "UNKNOWN", source: "unknown", label: null };
}

export const isMinorPenalty = (event) => /^(minor|minorpenalty|mensitrest)$/.test(key(event.penaltyDetails?.type?.name));
