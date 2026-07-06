import math
from typing import Optional

import httpx

from app.config import settings
from app.schemas.schemas import SpotResult


def _generate_mock_spots_near(lat: float, lng: float) -> list[SpotResult]:
  """Generate mock spots relative to the given coordinates (works anywhere in Japan)."""
  templates = [
    ("カフェ", "cafe", 1000, 4.2, 120),
    ("公園", "sightseeing", 0, 4.5, 500),
    ("レストラン", "gourmet", 2500, 4.0, 85),
    ("カフェ", "cafe", 1200, 4.3, 200),
    ("観光スポット", "sightseeing", 0, 4.6, 800),
    ("ダイニング", "gourmet", 3000, 4.1, 150),
  ]
  offsets = [
    (0.008, 0.005), (-0.006, 0.009), (0.004, -0.007),
    (0.010, 0.003), (-0.005, -0.008), (0.007, 0.010),
  ]
  results = []
  for i, (name_prefix, category, price, rating, reviews) in enumerate(templates):
    dlat, dlng = offsets[i]
    spot_lat = lat + dlat
    spot_lng = lng + dlng
    results.append(
      SpotResult(
        id=f"mock-{i}-{round(spot_lat, 4)}",
        name=f"近くの{name_prefix} {chr(65 + i)}",
        address=f"{name_prefix}（近く）",
        lat=spot_lat,
        lng=spot_lng,
        price=price,
        rating=rating,
        review_count=reviews,
        source="mock",
        category=category,
        hours="10:00-21:00",
        url="https://example.com/spot",
      )
    )
  return results


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  r = 6371.0
  dlat = math.radians(lat2 - lat1)
  dlng = math.radians(lng2 - lng1)
  a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
  return 2 * r * math.asin(math.sqrt(a))


CATEGORY_COMPAT: dict[str, set[str]] = {
  "cafe": {"cafe", "gourmet"},
  "gourmet": {"gourmet", "cafe"},
  "sightseeing": {"sightseeing", "activity"},
  "activity": {"activity", "sightseeing"},
}


class SpotSearchService:
  async def search(
    self,
    lat: float,
    lng: float,
    radius_km: float = 3.0,
    category: Optional[str] = None,
    budget: Optional[int] = None,
  ) -> list[SpotResult]:
    if not settings.hotpepper_api_key and not settings.yahoo_app_id:
      return self._search_mock(lat, lng, radius_km, category, budget)

    results: list[SpotResult] = []
    if settings.hotpepper_api_key and category in (None, "gourmet", "cafe"):
      results.extend(await self._search_hotpepper(lat, lng, budget))
    if settings.yahoo_app_id:
      results.extend(await self._search_yahoo(lat, lng, category, budget))

    if not results:
      return self._search_mock(lat, lng, radius_km, category, budget)

    return self._dedupe_and_filter(results, lat, lng, radius_km, category, budget)

  def _search_mock(
    self,
    lat: float,
    lng: float,
    radius_km: float,
    category: Optional[str],
    budget: Optional[int],
  ) -> list[SpotResult]:
    spots = _generate_mock_spots_near(lat, lng)
    results = []
    for spot in spots:
      dist = _haversine_km(lat, lng, spot.lat, spot.lng)
      if dist > radius_km:
        continue
      if category:
        allowed = CATEGORY_COMPAT.get(category, {category})
        if spot.category not in allowed:
          continue
      if budget is not None and spot.price > budget:
        continue
      results.append(spot)
    return results

  async def _search_hotpepper(self, lat: float, lng: float, budget: Optional[int]) -> list[SpotResult]:
    params = {
      "key": settings.hotpepper_api_key,
      "lat": lat,
      "lng": lng,
      "range": 3,
      "count": 20,
      "format": "json",
    }
    if budget is not None:
      if budget <= 1000:
        params["budget"] = "B001"
      elif budget <= 2000:
        params["budget"] = "B002"
      elif budget <= 4000:
        params["budget"] = "B003"
      else:
        params["budget"] = "B004"

    async with httpx.AsyncClient(timeout=15.0) as client:
      response = await client.get("https://webservice.recruit.co.jp/hotpepper/gourmet/v1/", params=params)
      response.raise_for_status()
      data = response.json()

    shops = data.get("results", {}).get("shop", [])
    if isinstance(shops, dict):
      shops = [shops]

    results = []
    for shop in shops:
      avg = shop.get("budget", {}).get("average", "0円")
      price = int("".join(filter(str.isdigit, avg)) or "0")
      results.append(
        SpotResult(
          id=shop.get("id"),
          name=shop.get("name", ""),
          address=shop.get("address", ""),
          lat=float(shop["lat"]),
          lng=float(shop["lng"]),
          price=price,
          rating=0.0,
          review_count=0,
          source="hotpepper",
          category="gourmet",
          image_url=shop.get("photo", {}).get("pc", {}).get("l"),
          url=shop.get("urls", {}).get("pc"),
        )
      )
    return results

  async def _search_yahoo(
    self,
    lat: float,
    lng: float,
    category: Optional[str],
    budget: Optional[int],
  ) -> list[SpotResult]:
    params = {
      "appid": settings.yahoo_app_id,
      "lat": lat,
      "lon": lng,
      "dist": 3,
      "results": 20,
      "output": "json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
      response = await client.get("https://map.yahooapis.jp/search/local/V1/localSearch", params=params)
      response.raise_for_status()
      data = response.json()

    features = data.get("Feature", [])
    results = []
    for feature in features:
      prop = feature.get("Property", {})
      geom = feature.get("Geometry", {}).get("Coordinates", "0,0").split(",")
      price = 0
      if budget is not None:
        price = min(budget, 2000)
      results.append(
        SpotResult(
          id=feature.get("Id"),
          name=prop.get("Name", ""),
          address=prop.get("Address", ""),
          lat=float(geom[1]),
          lng=float(geom[0]),
          price=price,
          rating=0.0,
          review_count=int(prop.get("ReviewCount", 0) or 0),
          source="yahoo",
          category=category or "sightseeing",
          url=prop.get("Url"),
        )
      )
    return results

  def _dedupe_and_filter(
    self,
    results: list[SpotResult],
    lat: float,
    lng: float,
    radius_km: float,
    category: Optional[str],
    budget: Optional[int],
  ) -> list[SpotResult]:
    seen = set()
    filtered = []
    for spot in results:
      key = (spot.name, round(spot.lat, 4), round(spot.lng, 4))
      if key in seen:
        continue
      seen.add(key)
      if _haversine_km(lat, lng, spot.lat, spot.lng) > radius_km:
        continue
      if category:
        allowed = CATEGORY_COMPAT.get(category, {category})
        if spot.category not in allowed:
          continue
      if budget is not None and spot.price > budget:
        continue
      filtered.append(spot)
    return filtered

  async def get_spot_info(self, spot_id: str, source: Optional[str] = None) -> Optional[SpotResult]:
    if source == "hotpepper" and settings.hotpepper_api_key:
      return await self._get_hotpepper_spot(spot_id)
    if spot_id.startswith("mock-") or source == "mock":
      parts = spot_id.split("-")
      if len(parts) >= 2:
        try:
          idx = int(parts[1])
          templates = [
            ("カフェ", "cafe", 1000, 4.2, 120),
            ("公園", "sightseeing", 0, 4.5, 500),
            ("レストラン", "gourmet", 2500, 4.0, 85),
            ("カフェ", "cafe", 1200, 4.3, 200),
            ("観光スポット", "sightseeing", 0, 4.6, 800),
            ("ダイニング", "gourmet", 3000, 4.1, 150),
          ]
          if idx < len(templates):
            name_prefix, category, price, rating, reviews = templates[idx]
            return SpotResult(
              id=spot_id,
              name=f"近くの{name_prefix} {chr(65 + idx)}",
              price=price,
              rating=rating,
              review_count=reviews,
              source="mock",
              category=category,
              lat=35.66,
              lng=139.70,
              hours="10:00-21:00",
              url="https://example.com/spot",
            )
        except ValueError:
          pass
    return None

  async def _get_hotpepper_spot(self, shop_id: str) -> Optional[SpotResult]:
    try:
      async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
          "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/",
          params={"key": settings.hotpepper_api_key, "id": shop_id, "format": "json"},
        )
        response.raise_for_status()
        data = response.json()
      shops = data.get("results", {}).get("shop", [])
      if isinstance(shops, dict):
        shops = [shops]
      if not shops:
        return None
      shop = shops[0]
      avg = shop.get("budget", {}).get("average", "0円")
      price = int("".join(filter(str.isdigit, avg)) or "0")
      open_hours = shop.get("open", "")
      return SpotResult(
        id=shop.get("id"),
        name=shop.get("name", ""),
        address=shop.get("address", ""),
        lat=float(shop["lat"]),
        lng=float(shop["lng"]),
        price=price,
        rating=0.0,
        review_count=0,
        source="hotpepper",
        category="gourmet",
        image_url=shop.get("photo", {}).get("pc", {}).get("l"),
        hours=open_hours,
        url=shop.get("urls", {}).get("pc"),
      )
    except Exception:
      return None
