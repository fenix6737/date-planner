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

function scorePlace(query: string, place: LocalPlace): number | null {
  const q = normalize(query);
  if (!q) return null;

  const qBase = stripAdminSuffix(q);
  const name = normalize(place.name);
  const nameBase = stripAdminSuffix(name);

  if (name === q || nameBase === qBase) return 0;
  if (name.startsWith(q) || nameBase.startsWith(qBase)) return 1;

  for (const alias of place.aliases || []) {
    const a = normalize(alias);
    if (a === q || a.startsWith(q)) return 2;
  }

  if (name.includes(q) || nameBase.includes(qBase)) return 3;

  const addr = normalize(place.address);
  const addrBase = stripAdminSuffix(addr);
  if (addr.includes(q) || addrBase.includes(qBase)) return 4;

  return null;
}

export function rankSuggestions(
  query: string,
  items: SuggestItem[],
  limit = 20,
  nearLat?: number,
  nearLng?: number
): SuggestItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items.slice(0, limit);

  const scored: Array<{ score: number; dist: number; item: SuggestItem }> = [];
  for (const item of items) {
    const place: LocalPlace = {
      name: item.name,
      address: item.address,
      lat: item.lat,
      lng: item.lng,
    };
    const score = scorePlace(trimmed, place);
    if (score === null) continue;
    const dist =
      nearLat !== undefined && nearLng !== undefined
        ? Math.hypot(item.lat - nearLat, item.lng - nearLng)
        : 0;
    scored.push({ score, dist, item });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.dist - b.dist || a.item.name.length - b.item.name.length
  );

  const results: SuggestItem[] = [];
  const seen = new Set<string>();
  for (const { item } of scored) {
    const key = `${item.name}:${item.lat}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= limit) break;
  }
  return results;
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

  const all: SuggestItem[] = LOCAL_PLACES.map((p) => ({
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
  }));

  return rankSuggestions(trimmed, all, limit, nearLat, nearLng);
}
