import places from "./localPlaces.json";
import type { SuggestItem } from "./api";

type LocalPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

const LOCAL_PLACES = places as LocalPlace[];

function normalize(text: string): string {
  return text.trim().replace(/　/g, " ").toLowerCase();
}

function stripAdminSuffix(text: string): string {
  for (const suffix of ["都", "道", "府", "県", "市", "区"]) {
    if (text.endsWith(suffix)) return text.slice(0, -suffix.length);
  }
  return text;
}

function scorePlace(query: string, place: LocalPlace): number | null {
  const q = normalize(query);
  if (!q) return null;

  const qBase = stripAdminSuffix(q);
  const candidates = [
    normalize(place.name),
    normalize(place.address),
    ...(place.aliases || []).map(normalize),
  ];

  let best: number | null = null;
  for (const cand of candidates) {
    if (!cand) continue;
    const candBase = stripAdminSuffix(cand);
    if (cand === q || candBase === qBase) return 0;
    if (cand.startsWith(q) || candBase.startsWith(qBase)) best = best === null ? 1 : Math.min(best, 1);
    else if (q.includes(cand) || qBase.includes(candBase)) best = best === null ? 2 : Math.min(best, 2);
    else if (cand.includes(q) || candBase.includes(qBase)) best = best === null ? 3 : Math.min(best, 3);
  }
  return best;
}

export function localSuggest(
  query: string,
  limit = 20,
  nearLat?: number,
  nearLng?: number
): SuggestItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return LOCAL_PLACES.filter((p) => p.address === p.name).slice(0, limit);
  }

  const scored: Array<{ score: number; dist: number; place: LocalPlace }> = [];
  for (const place of LOCAL_PLACES) {
    const score = scorePlace(trimmed, place);
    if (score === null) continue;
    const dist =
      nearLat !== undefined && nearLng !== undefined
        ? Math.hypot(place.lat - nearLat, place.lng - nearLng)
        : 0;
    scored.push({ score, dist, place });
  }

  scored.sort((a, b) => a.score - b.score || a.dist - b.dist || a.place.name.length - b.place.name.length);

  const results: SuggestItem[] = [];
  const seen = new Set<string>();
  for (const { place } of scored) {
    if (seen.has(place.name)) continue;
    seen.add(place.name);
    results.push({
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    });
    if (results.length >= limit) break;
  }
  return results;
}
