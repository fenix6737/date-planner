import math
from typing import Optional

import httpx

from app.config import settings


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  r = 6371.0
  dlat = math.radians(lat2 - lat1)
  dlng = math.radians(lng2 - lng1)
  a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
  return 2 * r * math.asin(math.sqrt(a))


def _haversine_duration_seconds(lat1: float, lng1: float, lat2: float, lng2: float, mode: str = "foot") -> float:
  distance_m = _haversine_km(lat1, lng1, lat2, lng2) * 1000
  speed_mps = 1.4 if mode == "foot" else 8.3
  return distance_m / speed_mps


class RouterService:
  async def get_route(
    self,
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    mode: str = "foot",
  ) -> dict:
    profile = "foot" if mode == "foot" else "driving"
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    url = f"{settings.osrm_base_url}/route/v1/{profile}/{coords}"

    try:
      async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params={"overview": "full", "geometries": "geojson"})
        response.raise_for_status()
        data = response.json()
      if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError("No route found")
      route = data["routes"][0]
      geometry = route["geometry"]["coordinates"]
      return {
        "distance": route["distance"],
        "duration": route["duration"],
        "geometry": geometry,
      }
    except Exception:
      duration = _haversine_duration_seconds(from_lat, from_lng, to_lat, to_lng, mode)
      distance = _haversine_km(from_lat, from_lng, to_lat, to_lng) * 1000
      return {
        "distance": distance,
        "duration": duration,
        "geometry": [[from_lng, from_lat], [to_lng, to_lat]],
      }

  async def get_matrix(
    self,
    coordinates: list[tuple[float, float]],
    mode: str = "foot",
  ) -> list[list[float]]:
    """Return duration matrix in seconds between all coordinate pairs."""
    n = len(coordinates)
    if n == 0:
      return []

    profile = "foot" if mode == "foot" else "driving"
    coord_str = ";".join(f"{lng},{lat}" for lat, lng in coordinates)
    url = f"{settings.osrm_base_url}/table/v1/{profile}/{coord_str}"

    try:
      async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params={"annotations": "duration"})
        response.raise_for_status()
        data = response.json()
      if data.get("code") != "Ok":
        raise ValueError("Matrix failed")
      durations = data.get("durations")
      if durations:
        return durations
    except Exception:
      pass

    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
      for j in range(n):
        if i == j:
          matrix[i][j] = 0.0
        else:
          lat1, lng1 = coordinates[i]
          lat2, lng2 = coordinates[j]
          matrix[i][j] = _haversine_duration_seconds(lat1, lng1, lat2, lng2, mode)
    return matrix
