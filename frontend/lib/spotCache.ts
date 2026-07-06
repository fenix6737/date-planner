import type { SpotResult } from "./api";

const CACHE_KEY = "spotDetailCache";

type SpotCache = Record<string, SpotResult>;

function cacheKey(id: string, source?: string): string {
  return `${source || "unknown"}:${id}`;
}

export function cacheSpot(spot: SpotResult): void {
  if (typeof window === "undefined" || !spot.id) return;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    const cache: SpotCache = raw ? JSON.parse(raw) : {};
    cache[cacheKey(spot.id, spot.source)] = spot;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors
  }
}

export function getCachedSpot(id: string, source?: string): SpotResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cache: SpotCache = JSON.parse(raw);
    return cache[cacheKey(id, source)] || null;
  } catch {
    return null;
  }
}

export function planItemToSpot(item: {
  name: string;
  lat: number;
  lng: number;
  budget_est: number;
  rating: number;
  review_count?: number;
  category?: string;
  source: string;
  source_id?: string;
  address?: string;
  image_url?: string;
  hours?: string;
  url?: string;
}): SpotResult {
  return {
    id: item.source_id || item.name,
    name: item.name,
    lat: item.lat,
    lng: item.lng,
    price: item.budget_est,
    rating: item.rating,
    review_count: item.review_count || 0,
    source: item.source,
    category: item.category,
    address: item.address,
    image_url: item.image_url,
    hours: item.hours,
    url: item.url,
  };
}
