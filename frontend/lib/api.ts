const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:8000";

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
}

export interface SuggestItem {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SpotResult {
  id?: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  price: number;
  rating: number;
  review_count: number;
  source: string;
  category?: string;
  image_url?: string;
  hours?: string;
  url?: string;
}

export interface PlanSpotItem {
  spot_id?: number;
  name: string;
  lat: number;
  lng: number;
  time: string;
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
  is_user_destination?: boolean;
}

export interface DestinationInput {
  name: string;
  lat: number;
  lng: number;
}

export interface GeneratePlanRequest {
  start: { lat: number; lng: number };
  date: string;
  budget: number;
  time_start: string;
  time_end: string;
  route_style: string;
  destinations: DestinationInput[];
  prefs?: Record<string, unknown>;
  gender?: string;
}

export interface GeneratePlanResponse {
  plan: PlanSpotItem[];
  total_time: string;
  total_distance: string;
  total_price: number;
}

export interface RouteResponse {
  distance: number;
  duration: number;
  geometry: number[][];
}

export interface SavedPlanResponse {
  id: number;
  share_token: string;
  share_url: string;
}

export interface PlanItemResponse {
  sequence: number;
  start_time: string;
  end_time: string;
  spot: SpotResult;
}

export interface PlanResponse {
  id: number;
  date: string;
  start_lat: number;
  start_lng: number;
  budget: number;
  preferences: Record<string, unknown>;
  share_token: string;
  total_time?: string;
  total_distance?: string;
  total_price: number;
  items: PlanItemResponse[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function geocode(
  query: string,
  nearLat?: number,
  nearLng?: number
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ q: query });
  if (nearLat !== undefined) params.set("nearLat", String(nearLat));
  if (nearLng !== undefined) params.set("nearLng", String(nearLng));
  return apiFetch(`/api/geocode?${params}`);
}

export async function suggestPlaces(
  query: string,
  nearLat?: number,
  nearLng?: number,
  limit = 20
): Promise<SuggestItem[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (nearLat !== undefined) params.set("nearLat", String(nearLat));
  if (nearLng !== undefined) params.set("nearLng", String(nearLng));
  return apiFetch(`/api/suggest?${params}`);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  return apiFetch(`/api/reverseGeocode?lat=${lat}&lng=${lng}`);
}

export async function generatePlan(data: GeneratePlanRequest): Promise<GeneratePlanResponse> {
  return apiFetch("/api/generatePlan", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  mode = "foot"
): Promise<RouteResponse> {
  const params = new URLSearchParams({
    fromLat: String(fromLat),
    fromLng: String(fromLng),
    toLat: String(toLat),
    toLng: String(toLng),
    mode,
  });
  return apiFetch(`/api/getRoute?${params}`);
}

export async function savePlan(data: {
  date: string;
  start_lat: number;
  start_lng: number;
  budget: number;
  preferences: Record<string, unknown>;
  total_time: string;
  total_distance: string;
  total_price: number;
  items: PlanSpotItem[];
}): Promise<SavedPlanResponse> {
  return apiFetch("/api/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPlan(id: number): Promise<PlanResponse> {
  return apiFetch(`/api/plans/${id}`);
}

export async function getPlanByShare(token: string): Promise<PlanResponse> {
  return apiFetch(`/api/plans/share/${token}`);
}

export async function getSpotInfo(id: string, source?: string): Promise<SpotResult> {
  const params = new URLSearchParams({ id });
  if (source) params.set("source", source);
  return apiFetch(`/api/spotInfo?${params}`);
}
