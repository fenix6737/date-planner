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
  },
  "active": {
    "categories": ["activity", "sightseeing"],
    "stay_multiplier": 0.8,
    "max_spots": 5,
  },
  "stylish": {
    "categories": ["cafe", "gourmet"],
    "stay_multiplier": 1.0,
    "max_spots": 4,
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

    filler_candidates: list[SpotResult] = []
    search_lat = sum(s.lat for s in mandatory_spots) / len(mandatory_spots)
    search_lng = sum(s.lng for s in mandatory_spots) / len(mandatory_spots)

    for category in categories:
      spots = await self.spot_search.search(
        lat=search_lat,
        lng=search_lng,
        radius_km=4.0,
        category=category,
        budget=budget,
      )
      filler_candidates.extend(spots)

    filler_candidates = self._dedupe(filler_candidates, mandatory_spots)
    scored_fillers = sorted(
      filler_candidates,
      key=lambda s: self._score(s, budget, gender),
      reverse=True,
    )

    auto_spots = self._select_within_budget(
      scored_fillers,
      budget,
      max_spots=style["max_spots"],
    )

    all_spots = mandatory_spots + [s for s in auto_spots if s not in mandatory_spots]
    coords = [(start_lat, start_lng)] + [(s.lat, s.lng) for s in all_spots]
    order = await self._greedy_order(coords)
    ordered_spots = [all_spots[i - 1] for i in order if i > 0]

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

  def _select_within_budget(
    self,
    scored: list[SpotResult],
    budget: int,
    max_spots: int,
  ) -> list[SpotResult]:
    selected = []
    total = 0
    for spot in scored:
      if len(selected) >= max_spots:
        break
      if total + spot.price <= budget or spot.price == 0:
        selected.append(spot)
        total += spot.price
    return selected

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
