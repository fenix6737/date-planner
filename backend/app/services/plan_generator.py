import math
from datetime import datetime, time, timedelta
from typing import Any, Optional

from app.schemas.schemas import DestinationInput, GeneratePlanResponse, PlanSpotItem, SpotResult
from app.services.router import RouterService
from app.services.spot_search import SpotSearchService


ROUTE_STYLES: dict[str, dict[str, Any]] = {
  "relaxed": {
    "categories": ["cafe", "sightseeing"],
    "stay_multiplier": 1.4,
    "max_spots": 4,
    "fillers_per_segment": 2,
  },
  "active": {
    "categories": ["activity", "sightseeing"],
    "stay_multiplier": 0.8,
    "max_spots": 5,
    "fillers_per_segment": 1,
  },
  "stylish": {
    "categories": ["cafe", "gourmet"],
    "stay_multiplier": 1.0,
    "max_spots": 4,
    "fillers_per_segment": 2,
  },
}

STAY_MINUTES = {
  "cafe": 40,
  "gourmet": 70,
  "sightseeing": 90,
  "activity": 75,
}

DEFAULT_STAY = 60

GENDER_CATEGORY_BOOST = {
  "M": {"gourmet": 1.1, "activity": 1.15},
  "F": {"cafe": 1.15, "sightseeing": 1.1},
}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  r = 6371.0
  dlat = math.radians(lat2 - lat1)
  dlng = math.radians(lng2 - lng1)
  a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
  return 2 * r * math.asin(math.sqrt(a))


def _point_to_segment_km(
  plat: float, plng: float,
  lat1: float, lng1: float,
  lat2: float, lng2: float,
) -> float:
  """Distance from point to line segment (lat/lng approx)."""
  dx = lat2 - lat1
  dy = lng2 - lng1
  if dx == 0 and dy == 0:
    return _haversine_km(plat, plng, lat1, lng1)
  t = max(0.0, min(1.0, ((plat - lat1) * dx + (plng - lng1) * dy) / (dx * dx + dy * dy)))
  proj_lat = lat1 + t * dx
  proj_lng = lng1 + t * dy
  return _haversine_km(plat, plng, proj_lat, proj_lng)


class PlanGeneratorService:
  def __init__(self):
    self.spot_search = SpotSearchService()
    self.router = RouterService()

  async def generate(
    self,
    start_lat: float,
    start_lng: float,
    budget: int,
    prefs: dict[str, Any],
    gender: Optional[str] = None,
    time_start: str = "09:00",
    time_end: str = "21:00",
    route_style: str = "relaxed",
    destinations: Optional[list[DestinationInput]] = None,
  ) -> GeneratePlanResponse:
    style = ROUTE_STYLES.get(route_style, ROUTE_STYLES["relaxed"])
    categories = style["categories"]
    day_start = self._parse_time(time_start)
    day_end = self._parse_time(time_end)

    if day_start >= day_end:
      raise ValueError("終了時刻は開始時刻より後にしてください")

    user_destinations = destinations or []
    if not user_destinations:
      raise ValueError("行きたい場所を1つ以上入力してください")

    mandatory_spots = [
      SpotResult(
        id=f"dest-{i}",
        name=d.name,
        lat=d.lat,
        lng=d.lng,
        price=0,
        rating=4.0,
        review_count=0,
        source="user",
        category="sightseeing",
        address=d.name,
      )
      for i, d in enumerate(user_destinations)
    ]

    dest_coords = [(start_lat, start_lng)] + [(s.lat, s.lng) for s in mandatory_spots]
    order = await self._greedy_order(dest_coords)
    ordered_dests = [mandatory_spots[i - 1] for i in order if i > 0]

    corridor_points = self._corridor_points(start_lat, start_lng, ordered_dests)
    filler_candidates: list[SpotResult] = []
    for clat, clng in corridor_points:
      for category in categories:
        spots = await self.spot_search.search(
          lat=clat,
          lng=clng,
          radius_km=2.0,
          category=category,
          budget=budget,
        )
        filler_candidates.extend(spots)

    filler_candidates = self._dedupe(filler_candidates, mandatory_spots)
    ordered_spots = self._insert_fillers_along_route(
      start_lat,
      start_lng,
      ordered_dests,
      filler_candidates,
      budget,
      gender,
      style["max_spots"],
      style["fillers_per_segment"],
    )

    plan_items, total_price = await self._build_schedule(
      start_lat,
      start_lng,
      ordered_spots,
      day_start,
      day_end,
      style["stay_multiplier"],
      {s.name for s in mandatory_spots},
    )

    if total_price > budget:
      raise ValueError("予算内に収まるプランを作れませんでした。予算を増やすか、行きたい場所を減らしてください")

    total_distance_m = 0.0
    prev_lat, prev_lng = start_lat, start_lng
    for spot in ordered_spots:
      route = await self.router.get_route(prev_lat, prev_lng, spot.lat, spot.lng)
      total_distance_m += route["distance"]
      prev_lat, prev_lng = spot.lat, spot.lng

    actual_start = plan_items[0].time.split("-")[0] if plan_items else time_start
    actual_end = plan_items[-1].time.split("-")[1] if plan_items else time_end

    return GeneratePlanResponse(
      plan=plan_items,
      total_time=f"{actual_start}-{actual_end}",
      total_distance=f"{total_distance_m / 1000:.1f}km",
      total_price=total_price,
    )

  def _corridor_points(
    self,
    start_lat: float,
    start_lng: float,
    ordered_dests: list[SpotResult],
  ) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = [(start_lat, start_lng)]
    prev_lat, prev_lng = start_lat, start_lng
    for dest in ordered_dests:
      mid_lat = (prev_lat + dest.lat) / 2
      mid_lng = (prev_lng + dest.lng) / 2
      points.append((mid_lat, mid_lng))
      points.append((dest.lat, dest.lng))
      prev_lat, prev_lng = dest.lat, dest.lng
    return points

  def _insert_fillers_along_route(
    self,
    start_lat: float,
    start_lng: float,
    ordered_dests: list[SpotResult],
    fillers: list[SpotResult],
    budget: int,
    gender: Optional[str],
    max_fillers: int,
    per_segment: int,
  ) -> list[SpotResult]:
    if not ordered_dests:
      return []

    used_names: set[str] = {d.name for d in ordered_dests}
    selected_fillers: list[SpotResult] = []
    filler_budget = 0

    route: list[SpotResult] = []
    prev_lat, prev_lng = start_lat, start_lng

    for dest in ordered_dests:
      segment_fillers = self._pick_fillers_for_segment(
        prev_lat, prev_lng, dest.lat, dest.lng,
        fillers, used_names, budget, gender, per_segment,
      )
      for f in segment_fillers:
        if len(selected_fillers) >= max_fillers:
          break
        if filler_budget + f.price > budget and f.price > 0:
          continue
        selected_fillers.append(f)
        used_names.add(f.name)
        filler_budget += f.price
        route.append(f)

      route.append(dest)
      prev_lat, prev_lng = dest.lat, dest.lng

    return route

  def _pick_fillers_for_segment(
    self,
    lat1: float, lng1: float,
    lat2: float, lng2: float,
    fillers: list[SpotResult],
    used_names: set[str],
    budget: int,
    gender: Optional[str],
    limit: int,
  ) -> list[SpotResult]:
    scored: list[tuple[float, SpotResult]] = []
    for spot in fillers:
      if spot.name in used_names:
        continue
      dist = _point_to_segment_km(spot.lat, spot.lng, lat1, lng1, lat2, lng2)
      if dist > 1.2:
        continue
      direct = _haversine_km(lat1, lng1, lat2, lng2)
      via = _haversine_km(lat1, lng1, spot.lat, spot.lng) + _haversine_km(spot.lat, spot.lng, lat2, lng2)
      detour_km = via - direct
      if detour_km > 2.5:
        continue
      quality = self._score(spot, budget, gender)
      combined = dist * 2.0 - quality * 0.3
      scored.append((combined, spot))

    scored.sort(key=lambda x: x[0])
    return [s for _, s in scored[:limit]]

  def _parse_time(self, value: str) -> time:
    parts = value.split(":")
    return time(int(parts[0]), int(parts[1]))

  def _dedupe(
    self,
    candidates: list[SpotResult],
    exclude: list[SpotResult],
  ) -> list[SpotResult]:
    exclude_keys = {(s.name, round(s.lat, 4), round(s.lng, 4)) for s in exclude}
    seen = set(exclude_keys)
    result = []
    for spot in candidates:
      key = (spot.name, round(spot.lat, 4), round(spot.lng, 4))
      if key in seen:
        continue
      seen.add(key)
      result.append(spot)
    return result

  def _score(self, spot: SpotResult, budget: int, gender: Optional[str]) -> float:
    review_factor = math.log(spot.review_count + 1)
    rating_factor = spot.rating if spot.rating > 0 else 3.5
    if budget > 0 and spot.price > 0:
      budget_fit = max(0.1, 1.0 - abs(spot.price - budget * 0.25) / budget)
    else:
      budget_fit = 1.0
    boost = 1.0
    if gender and spot.category:
      boost = GENDER_CATEGORY_BOOST.get(gender, {}).get(spot.category, 1.0)
    return rating_factor * review_factor * budget_fit * boost

  async def _greedy_order(self, coords: list[tuple[float, float]]) -> list[int]:
    n = len(coords)
    if n <= 2:
      return list(range(n))

    matrix = await self.router.get_matrix(coords)
    visited = {0}
    order = [0]
    current = 0

    while len(visited) < n:
      best_j = -1
      best_duration = float("inf")
      for j in range(n):
        if j in visited:
          continue
        if matrix[current][j] < best_duration:
          best_duration = matrix[current][j]
          best_j = j
      if best_j == -1:
        break
      visited.add(best_j)
      order.append(best_j)
      current = best_j

    return order

  async def _build_schedule(
    self,
    start_lat: float,
    start_lng: float,
    spots: list[SpotResult],
    day_start: time,
    day_end: time,
    stay_multiplier: float,
    user_dest_names: set[str],
  ) -> tuple[list[PlanSpotItem], int]:
    current_dt = datetime.combine(datetime.today(), day_start)
    end_dt = datetime.combine(datetime.today(), day_end)
    items: list[PlanSpotItem] = []
    total_price = 0
    prev_lat, prev_lng = start_lat, start_lng

    for spot in spots:
      route = await self.router.get_route(prev_lat, prev_lng, spot.lat, spot.lng)
      travel_minutes = max(1, int(route["duration"] / 60))
      current_dt += timedelta(minutes=travel_minutes)

      base_stay = STAY_MINUTES.get(spot.category or "", DEFAULT_STAY)
      stay = int(base_stay * stay_multiplier)
      spot_end = current_dt + timedelta(minutes=stay)

      if spot_end > end_dt:
        if spot.name in user_dest_names and not items:
          pass
        else:
          break

      time_str = f"{current_dt.strftime('%H:%M')}-{spot_end.strftime('%H:%M')}"
      items.append(
        PlanSpotItem(
          name=spot.name,
          lat=spot.lat,
          lng=spot.lng,
          time=time_str,
          budget_est=spot.price,
          rating=spot.rating,
          review_count=spot.review_count,
          category=spot.category,
          source=spot.source,
          source_id=spot.id,
          address=spot.address,
          image_url=spot.image_url,
          hours=spot.hours,
          url=spot.url,
          is_user_destination=spot.name in user_dest_names,
        )
      )
      total_price += spot.price
      current_dt = spot_end
      prev_lat, prev_lng = spot.lat, spot.lng

    if not items:
      raise ValueError("指定した時間内に収まるプランを作れませんでした。時間帯を広げてください")

    return items, total_price
