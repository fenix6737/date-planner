from typing import Optional

import httpx

from app.config import settings


class PoiSearchService:
  async def search(
    self,
    query: str,
    near_lat: Optional[float] = None,
    near_lng: Optional[float] = None,
    limit: int = 10,
  ) -> list[dict]:
    normalized = query.strip()
    if not normalized:
      return []

    results: list[dict] = []
    if settings.hotpepper_api_key:
      results.extend(await self._search_hotpepper(normalized, near_lat, near_lng, limit))

    if settings.yahoo_app_id and len(results) < limit:
      results.extend(await self._search_yahoo(normalized, near_lat, near_lng, limit - len(results)))

    return self._dedupe(results)[:limit]

  async def _search_hotpepper(
    self,
    query: str,
    near_lat: Optional[float],
    near_lng: Optional[float],
    limit: int,
  ) -> list[dict]:
    params: dict = {
      "key": settings.hotpepper_api_key,
      "keyword": query,
      "count": min(limit, 30),
      "format": "json",
    }
    if near_lat is not None and near_lng is not None:
      params["lat"] = near_lat
      params["lng"] = near_lng
      params["range"] = 5

    try:
      async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(
          "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
          params=params,
        )
        if response.status_code != 200:
          return []
        data = response.json()
    except Exception:
      return []

    shops = data.get("results", {}).get("shop", [])
    if isinstance(shops, dict):
      shops = [shops]

    items = []
    for shop in shops:
      name = shop.get("name", "")
      address = shop.get("address") or shop.get("middle_area", {}).get("name", "")
      if not name or not shop.get("lat") or not shop.get("lng"):
        continue
      items.append({
        "name": name,
        "address": address,
        "lat": float(shop["lat"]),
        "lng": float(shop["lng"]),
      })
    return items

  async def _search_yahoo(
    self,
    query: str,
    near_lat: Optional[float],
    near_lng: Optional[float],
    limit: int,
  ) -> list[dict]:
    params: dict = {
      "appid": settings.yahoo_app_id,
      "query": query,
      "results": min(limit, 20),
      "output": "json",
    }
    if near_lat is not None and near_lng is not None:
      params["lat"] = near_lat
      params["lon"] = near_lng
      params["dist"] = 5

    try:
      async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.get(
          "https://map.yahooapis.jp/search/local/V1/localSearch",
          params=params,
        )
        if response.status_code != 200:
          return []
        data = response.json()
    except Exception:
      return []

    items = []
    for feature in data.get("Feature", []):
      prop = feature.get("Property", {})
      coords = feature.get("Geometry", {}).get("Coordinates", "0,0").split(",")
      if len(coords) < 2:
        continue
      name = prop.get("Name", "")
      if not name:
        continue
      items.append({
        "name": name,
        "address": prop.get("Address", ""),
        "lat": float(coords[1]),
        "lng": float(coords[0]),
      })
    return items

  def _dedupe(self, items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique = []
    for item in items:
      key = f"{item['name']}:{round(item['lat'], 4)}:{round(item['lng'], 4)}"
      if key in seen:
        continue
      seen.add(key)
      unique.append(item)
    return unique
