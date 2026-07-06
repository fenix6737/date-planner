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
  for (const suffix of ["都", "道", "府", "県", "市", "区", "町", "村"]) {
    if (text.endsWith(suffix)) return text.slice(0, -suffix.length);
  }
  return text;
}

export function rankPlace(query: string, place: Pick<SuggestItem, "name" | "address">): number | null {
  const q = normalize(query);
  if (!q) {
    return place.name === place.address ? 0 : 5;
  }

  const qBase = stripAdminSuffix(q);
  const names = [normalize(place.name), normalize(place.address)];
  let best: number | null = null;

  for (const cand of names) {
    if (!cand) continue;
    const candBase = stripAdminSuffix(cand);
    let score: number | null = null;

    if (cand === q || candBase === qBase) score = 0;
    else if (cand.startsWith(q) || candBase.startsWith(qBase)) score = 1;
    else if (q.startsWith(cand) || qBase.startsWith(candBase)) score = 2;
    else if (cand.includes(q) || candBase.includes(qBase)) score = 3;
    else if (q.includes(cand) || qBase.includes(candBase)) score = 4;

    if (score !== null) {
      best = best === null ? score : Math.min(best, score);
    }
  }

  return best;
}

function scorePlace(query: string, place: LocalPlace): number | null {
  return rankPlace(query, place);
}

export function mergeRankedSuggestions(
  query: string,
  local: SuggestItem[],
  remote: SuggestItem[],
  limit: number
): SuggestItem[] {
  const combined = [...local, ...remote];
  const seen = new Set<string>();
  const ranked: Array<{ item: SuggestItem; score: number }> = [];

  for (const item of combined) {
    const key = `${item.name}:${item.lat}:${item.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const score = rankPlace(query, item);
    if (score === null) continue;
    ranked.push({ item, score });
  }

  ranked.sort(
    (a, b) =>
      a.score - b.score ||
      a.item.name.length - b.item.name.length ||
      a.item.name.localeCompare(b.item.name, "ja")
  );

  return ranked.slice(0, limit).map((entry) => entry.item);
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

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.dist - b.dist ||
      a.place.name.length - b.place.name.length ||
      a.place.name.localeCompare(b.place.name, "ja")
  );

  const results: SuggestItem[] = [];
  const seen = new Set<string>();
  for (const { place } of scored) {
    const key = `${place.name}:${place.lat}:${place.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
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
