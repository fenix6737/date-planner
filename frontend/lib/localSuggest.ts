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
const PREFECTURES = LOCAL_PLACES.filter((p) => p.name === p.address);

function normalize(text: string): string {
  return text.trim().replace(/　/g, " ").toLowerCase();
}

function stripAdminSuffix(text: string): string {
  for (const suffix of ["都", "道", "府", "県", "市", "区", "町", "村"]) {
    if (text.endsWith(suffix)) return text.slice(0, -suffix.length);
  }
  return text;
}

function splitAdminTokens(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tokens: string[] = [];
  const re = /([^都道府県]+[都道府県]|[^市区町村]+[市区町村])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(trimmed)) !== null) {
    tokens.push(match[0]);
  }

  if (tokens.length === 0) return [trimmed];
  return tokens;
}

function placeCandidates(place: LocalPlace): string[] {
  return [
    normalize(place.name),
    normalize(place.address),
    ...(place.aliases || []).map(normalize),
  ].filter(Boolean);
}

export function rankPlace(
  query: string,
  place: Pick<SuggestItem, "name" | "address"> & { aliases?: string[] }
): number | null {
  const q = normalize(query);
  if (!q) {
    return place.name === place.address ? 0 : 5;
  }

  const qBase = stripAdminSuffix(q);
  let best: number | null = null;

  for (const cand of placeCandidates(place as LocalPlace)) {
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

function searchOnce(
  query: string,
  limit: number,
  nearLat?: number,
  nearLng?: number
): SuggestItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return PREFECTURES.slice(0, limit).map((place) => ({
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    }));
  }

  const scored: Array<{ score: number; dist: number; place: LocalPlace }> = [];
  for (const place of LOCAL_PLACES) {
    const score = rankPlace(trimmed, place);
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
    return searchOnce("", limit, nearLat, nearLng);
  }

  const tokens = splitAdminTokens(trimmed);
  const merged: SuggestItem[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    for (const item of searchOnce(token, limit, nearLat, nearLng)) {
      const key = `${item.name}:${item.lat}:${item.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  if (merged.length < limit) {
    for (const item of searchOnce(trimmed, limit, nearLat, nearLng)) {
      const key = `${item.name}:${item.lat}:${item.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return mergeRankedSuggestions(trimmed, merged, [], limit);
}

export function hasStrongLocalMatches(query: string, minCount = 5): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  const results = localSuggest(trimmed, minCount, undefined, undefined);
  if (results.length < minCount) return false;
  return results.every((item) => (rankPlace(trimmed, item) ?? 99) <= 2);
}
