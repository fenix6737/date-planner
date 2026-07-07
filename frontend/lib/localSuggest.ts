import places from "./localPlaces.json";
import type { SuggestItem } from "./api";
import { filterSuggestions, isAreaPlace } from "./placeFilters";

type LocalPlace = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

const LOCAL_PLACES = places as LocalPlace[];
const PREFECTURES = LOCAL_PLACES.filter((p) => p.name === p.address);
const PREFECTURE_NAMES = new Set(PREFECTURES.map((p) => normalize(p.name)));

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

function resolvePrefectureBrowse(query: string): string | null {
  const q = normalize(query);
  if (!q) return null;

  for (const pref of PREFECTURES) {
    const name = normalize(pref.name);
    if (q === name || name.startsWith(q)) {
      return pref.name;
    }
  }
  return null;
}

function isCityLevel(place: LocalPlace): boolean {
  return place.name.endsWith("市") || place.name.endsWith("町") || place.name.endsWith("村");
}

function isWardLevel(place: LocalPlace): boolean {
  return place.name.endsWith("区");
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

function listPrefecturePlaces(prefecture: string, limit: number): SuggestItem[] {
  const matches = LOCAL_PLACES.filter(
    (place) => place.address.startsWith(prefecture) || place.name === prefecture
  );

  matches.sort((a, b) => {
    const rank = (place: LocalPlace) => {
      if (place.name === prefecture) return 0;
      if (isCityLevel(place)) return 1;
      if (isWardLevel(place)) return 2;
      if (place.name.endsWith("駅")) return 3;
      if (isAreaPlace(place)) return 4;
      return 5;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "ja");
  });

  return matches.slice(0, limit).map((place) => ({
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
  }));
}

function searchOnce(
  query: string,
  limit: number,
  nearLat?: number,
  nearLng?: number,
  useDistance = true
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

  const prefectureBrowse = resolvePrefectureBrowse(trimmed);
  if (prefectureBrowse) {
    return listPrefecturePlaces(prefectureBrowse, limit);
  }

  const scored: Array<{ score: number; dist: number; place: LocalPlace }> = [];
  for (const place of LOCAL_PLACES) {
    const score = rankPlace(trimmed, place);
    if (score === null) continue;
    const dist =
      useDistance && nearLat !== undefined && nearLng !== undefined
        ? Math.hypot(place.lat - nearLat, place.lng - nearLng)
        : 0;
    scored.push({ score, dist, place });
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.dist - b.dist ||
      (isCityLevel(a.place) ? 0 : isWardLevel(a.place) ? 1 : 2) -
        (isCityLevel(b.place) ? 0 : isWardLevel(b.place) ? 1 : 2) ||
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

export type LocalSuggestOptions = {
  nearLat?: number;
  nearLng?: number;
  areasOnly?: boolean;
  prefecture?: string;
};

export function localSuggest(
  query: string,
  limit = 20,
  options: LocalSuggestOptions = {}
): SuggestItem[] {
  const { nearLat, nearLng, areasOnly = false, prefecture } = options;
  const trimmed = query.trim();
  const prefectureBrowse = trimmed ? resolvePrefectureBrowse(trimmed) : null;
  const effectiveLimit = prefectureBrowse ? Math.max(limit, 47) : limit;
  const useDistance = !prefectureBrowse && !PREFECTURE_NAMES.has(normalize(trimmed));

  if (!trimmed) {
    const base = searchOnce("", limit, nearLat, nearLng, useDistance);
    return filterSuggestions(base, { areasOnly, prefecture });
  }

  const tokens = splitAdminTokens(trimmed);
  const merged: SuggestItem[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    for (const item of searchOnce(token, effectiveLimit, nearLat, nearLng, useDistance)) {
      const key = `${item.name}:${item.lat}:${item.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  if (merged.length < effectiveLimit) {
    for (const item of searchOnce(trimmed, effectiveLimit, nearLat, nearLng, useDistance)) {
      const key = `${item.name}:${item.lat}:${item.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  const ranked = mergeRankedSuggestions(trimmed, merged, [], effectiveLimit);
  return filterSuggestions(ranked, { areasOnly, prefecture });
}

export function hasStrongLocalMatches(query: string, minCount = 5): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (resolvePrefectureBrowse(trimmed)) return true;
  const results = localSuggest(trimmed, minCount);
  if (results.length < minCount) return false;
  return results.every((item) => (rankPlace(trimmed, item) ?? 99) <= 2);
}
