import math
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.data.japan_places import JAPAN_PLACES, PlaceEntry
from app.models.models import GeocodeCache
from app.services.poi_search import PoiSearchService


class GeocoderService:
  def __init__(self, db: Session):
    self.db = db
    self._last_request_at: float = 0.0
    self._poi = PoiSearchService()

  def _normalize(self, text: str) -> str:
    return text.strip().replace("　", " ").lower()

  def _strip_admin_suffix(self, text: str) -> str:
    for suffix in ("都", "道", "府", "県", "市", "区"):
      if text.endswith(suffix):
        return text[: -len(suffix)]
    return text

  def _score_place(self, query: str, place: PlaceEntry) -> Optional[float]:
    q = self._normalize(query)
    if not q:
      return None

    q_base = self._strip_admin_suffix(q)
    candidates = [self._normalize(place["name"]), self._normalize(place["address"]), *[self._normalize(a) for a in place["aliases"]]]
    best = None
    for cand in candidates:
      if not cand:
        continue
      cand_base = self._strip_admin_suffix(cand)
      if cand == q or cand_base == q_base:
        return 0.0
      if cand.startswith(q) or cand_base.startswith(q_base):
        best = 1.0 if best is None else min(best, 1.0)
      elif q in cand or q_base in cand_base:
        best = 2.0 if best is None else min(best, 2.0)
      elif cand in q or cand_base in q_base:
        best = 3.0 if best is None else min(best, 3.0)
    return best

  def _local_search(
    self,
    query: str,
    limit: int = 20,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
  ) -> list[dict]:
    scored: list[tuple[float, float, PlaceEntry]] = []
    for place in JAPAN_PLACES:
      score = self._score_place(query, place)
      if score is not None:
        dist = (
          self._haversine_km(near_lat, near_lng, place["lat"], place["lng"])
          if near_lat is not None and near_lng is not None
          else 0.0
        )
        scored.append((score, dist, place))
    scored.sort(key=lambda x: (x[0], x[1], len(x[2]["name"])))
    results = []
    seen = set()
    for _, _, place in scored:
      key = place["name"]
      if key in seen:
        continue
      seen.add(key)
      results.append({
        "name": place["name"],
        "address": place["address"],
        "lat": place["lat"],
        "lng": place["lng"],
      })
      if len(results) >= limit:
        break
    return results

  def _local_match(
    self,
    query: str,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
  ) -> Optional[dict]:
    results = self._local_search(query, limit=1, near_lat=near_lat, near_lng=near_lng)
    if not results:
      return None
    top = results[0]
    return {"lat": top["lat"], "lng": top["lng"], "address": top["address"]}

  def _haversine_km(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

  async def suggest(
    self,
    query: str,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
    limit: int = 20,
  ) -> list[dict]:
    normalized = query.strip()
    if len(normalized) < 1:
      from app.data.japan_places import PREFECTURES

      return [
        {"name": p["name"], "address": p["address"], "lat": p["lat"], "lng": p["lng"]}
        for p in PREFECTURES[:limit]
      ]

    local_results = self._local_search(normalized, limit=limit, near_lat=near_lat, near_lng=near_lng)
    if len(local_results) >= limit:
      return local_results[:limit]

    gsi_results = await self._gsi_search(normalized, limit - len(local_results))
    merged = list(local_results)
    seen = {item["name"] for item in merged}
    for item in gsi_results:
      if item["name"] in seen:
        continue
      seen.add(item["name"])
      merged.append(item)
      if len(merged) >= limit:
        break

    if len(merged) < limit:
      poi_results = await self._poi.search(normalized, near_lat, near_lng, limit - len(merged))
      for item in poi_results:
        if item["name"] in seen:
          continue
        seen.add(item["name"])
        merged.append(item)
        if len(merged) >= limit:
          break

    return merged[:limit]

  async def reverse_geocode(self, lat: float, lng: float) -> dict:
    cache_key = f"reverse:{round(lat, 5)}:{round(lng, 5)}"
    cached = self.db.query(GeocodeCache).filter(GeocodeCache.query == cache_key).first()
    if cached:
      return {"lat": cached.lat, "lng": cached.lng, "address": cached.address}

    remote = await self._heartrails_reverse(lat, lng)
    if remote:
      cache_entry = GeocodeCache(query=cache_key, lat=lat, lng=lng, address=remote["address"])
      self.db.add(cache_entry)
      self.db.commit()
      return remote

    nearest = self._nearest_place(lat, lng)
    if nearest:
      address = f"{nearest['address']}付近"
      cache_entry = GeocodeCache(query=cache_key, lat=lat, lng=lng, address=address)
      self.db.add(cache_entry)
      self.db.commit()
      return {"lat": lat, "lng": lng, "address": address}

    return {"lat": lat, "lng": lng, "address": "選択した地点付近"}

  async def geocode(
    self,
    query: str,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
  ) -> dict:
    normalized = query.strip()
    if not normalized:
      raise ValueError("Query is required")

    local = self._local_match(normalized, near_lat, near_lng)
    if local:
      return local

    cached = self.db.query(GeocodeCache).filter(GeocodeCache.query == normalized).first()
    if cached:
      return {"lat": cached.lat, "lng": cached.lng, "address": cached.address}

    gsi = await self._gsi_search(normalized, 1)
    if gsi:
      item = gsi[0]
      result = {"lat": item["lat"], "lng": item["lng"], "address": item["address"]}
      cache_entry = GeocodeCache(query=normalized, lat=result["lat"], lng=result["lng"], address=result["address"])
      self.db.add(cache_entry)
      self.db.commit()
      return result

    poi = await self._poi.search(normalized, near_lat, near_lng, 1)
    if poi:
      item = poi[0]
      result = {"lat": item["lat"], "lng": item["lng"], "address": f"{item['name']}（{item['address']}）"}
      cache_entry = GeocodeCache(query=normalized, lat=result["lat"], lng=result["lng"], address=result["address"])
      self.db.add(cache_entry)
      self.db.commit()
      return result

    raise LookupError(
      f"「{normalized}」が見つかりませんでした。"
      "市区町村・駅名・店名で入力するか、候補から選んでください。"
    )

  def _nearest_place(self, lat: float, lng: float) -> Optional[dict]:
    best = None
    best_dist = float("inf")
    for place in JAPAN_PLACES:
      dist = self._haversine_km(lat, lng, place["lat"], place["lng"])
      if dist < best_dist:
        best_dist = dist
        best = place
    if best and best_dist < 80:
      return {"name": best["name"], "address": best["address"], "lat": best["lat"], "lng": best["lng"]}
    return None

  async def _heartrails_reverse(self, lat: float, lng: float) -> Optional[dict]:
    try:
      async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
          "https://geoapi.heartrails.com/api/json",
          params={"method": "searchByGeoLocation", "x": lng, "y": lat},
        )
        if response.status_code != 200:
          return None
        data = response.json()
        locations = data.get("response", {}).get("location", [])
        if not locations:
          return None
        loc = locations[0]
        prefecture = loc.get("prefecture", "")
        city = loc.get("city", "")
        town = loc.get("town", "")
        address = f"{prefecture}{city}{town}".strip()
        if not address:
          return None
        return {"lat": lat, "lng": lng, "address": address}
    except Exception:
      return None

  async def _gsi_search(self, query: str, limit: int) -> list[dict]:
    try:
      async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
          "https://msearch.gsi.go.jp/address-search/AddressSearch",
          params={"q": query},
        )
        if response.status_code != 200:
          return []
        results = response.json()
        items: list[dict] = []
        seen: set[str] = set()
        for item in results:
          props = item.get("properties", {})
          coords = item.get("geometry", {}).get("coordinates", [])
          if len(coords) < 2:
            continue
          title = str(props.get("title") or query).strip()
          short_name = title
          for marker in ("都", "道", "府", "県"):
            if marker in title:
              short_name = title.split(marker, 1)[-1] or title
              break
          key = f"{title}:{coords[0]}:{coords[1]}"
          if key in seen:
            continue
          seen.add(key)
          items.append({
            "name": short_name,
            "address": title,
            "lat": float(coords[1]),
            "lng": float(coords[0]),
          })
          if len(items) >= limit:
            break
        return items
    except Exception:
      return []

  async def _nominatim_search(self, query: str, limit: int) -> list[dict]:
    if settings.mock_mode:
      return []
    try:
      await self._rate_limit()
      async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
          f"{settings.nominatim_base_url}/search",
          params={"q": query, "format": "json", "limit": limit, "countrycodes": "jp"},
          headers={"User-Agent": "DatePlanner/1.0 (dev@example.com)", "Accept-Language": "ja"},
        )
        if response.status_code != 200:
          return []
        results = response.json()
        items = []
        for r in results:
          name = r.get("name") or r.get("display_name", "").split(",")[0]
          items.append({
            "name": name,
            "address": r.get("display_name", name),
            "lat": float(r["lat"]),
            "lng": float(r["lon"]),
          })
        return items
    except Exception:
      return []

  async def _nominatim_reverse(self, lat: float, lng: float) -> Optional[dict]:
    if settings.mock_mode:
      return None
    try:
      await self._rate_limit()
      async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
          f"{settings.nominatim_base_url}/reverse",
          params={"lat": lat, "lon": lng, "format": "json"},
          headers={"User-Agent": "DatePlanner/1.0 (dev@example.com)", "Accept-Language": "ja"},
        )
        if response.status_code != 200:
          return None
        result = response.json()
        if result and "error" not in result:
          return {"lat": lat, "lng": lng, "address": result.get("display_name", f"{lat:.4f}, {lng:.4f}")}
    except Exception:
      pass
    return None

  async def _rate_limit(self) -> None:
    import asyncio
    import time

    now = time.time()
    elapsed = now - self._last_request_at
    if elapsed < 1.1:
      await asyncio.sleep(1.1 - elapsed)
    self._last_request_at = time.time()
