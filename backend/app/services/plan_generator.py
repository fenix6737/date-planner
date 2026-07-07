import math
from datetime import datetime, time, timedelta
from typing import Any, Optional

from app.schemas.schemas import DestinationInput, GeneratePlanResponse, PlanSpotItem, SpotResult
from app.services.router import RouterService
from app.services.spot_search import SpotSearchService


ROUTE_STYLES: dict[str, dict[str, Any]] = {
  "relaxed": {
    "categories": ["cafe", "sightseeing", "gourmet"],
    "stay_multiplier": 1.2,
    "max_fillers": 6,
  },
  "active": {
    "categories": ["activity", "sightseeing", "gourmet"],
    "stay_multiplier": 0.8,
    "max_fillers": 7,
  },
  "stylish": {
    "categories": ["cafe", "gourmet"],
    "stay_multiplier": 1.0,
    "max_fillers": 6,
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


def _distance_to_segment_km(
  lat: float,
  lng: float,
  lat1: float,
  lng1: float,
  lat2: float,
  lng2: float,
) -> float:
  """Approximate distance from point to line segment (lat/lng)."""
  dx = lat2 - lat1
  dy = lng2 - lng1
  if dx == 0 and dy == 0:
    return _haversine_km(lat, lng, lat1, lng1)
  t = max(0.0, min(1.0, ((lat - lat1) * dx + (lng - lng1) * dy) / (dx * dx + dy * dy)))
  proj_lat = lat1 + t * dx
  proj_lng = lng1 + t * dy
  return _haversine_km(lat, lng, proj_lat, proj_lng)


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
      await self._enrich_destination(d, i, budget)
      for i, d in enumerate(user_destinations)
    ]

    ordered_mandatory = await self._order_mandatory_from_start(
      start_lat, start_lng, mandatory_spots
    )

    filler_candidates = await self._search_along_route(
      start_lat,
      start_lng,
      ordered_mandatory,
      categories,
      budget,
      mandatory_spots,
    )

    scored_fillers = sorted(
      filler_candidates,
      key=lambda s: self._score(s, budget, gender),
      reverse=True,
    )

    ordered_spots = self._interleave_route_stops(
      start_lat,
      start_lng,
      ordered_mandatory,
      scored_fillers,
      max_per_leg=2,
      max_total=style["max_fillers"],
    )

    mandatory_ids = {s.id for s in mandatory_spots}
    plan_items, total_price = await self._build_schedule(
      start_lat,
      start_lng,
      ordered_spots,
      day_start,
      day_end,
      style["stay_multiplier"],
      mandatory_ids,
    )

    mandatory_price = sum(item.budget_est for item in plan_items if item.is_user_destination)
    if mandatory_price > budget:
      raise ValueError(
        "選択した行きたい場所だけで予算を超えています。予算を増やすか、場所を減らしてください"
      )

    while total_price > budget:
      removable = [i for i, item in enumerate(plan_items) if not item.is_user_destination]
      if not removable:
        break
      idx = removable[-1]
      total_price -= plan_items[idx].budget_est
      plan_items.pop(idx)

    if total_price > budget:
      raise ValueError("予算内に収まるプランを作れませんでした。予算を増やすか、行きたい場所を減らしてください")

    total_distance_m = 0.0
    prev_lat, prev_lng = start_lat, start_lng
    for item in plan_items:
      route = await self.router.get_route(prev_lat, prev_lng, item.lat, item.lng)
      total_distance_m += route["distance"]
      prev_lat, prev_lng = item.lat, item.lng

    actual_start = plan_items[0].time.split("-")[0] if plan_items else time_start
    actual_end = plan_items[-1].time.split("-")[1] if plan_items else time_end

    return GeneratePlanResponse(
      plan=plan_items,
      total_time=f"{actual_start}-{actual_end}",
      total_distance=f"{total_distance_m / 1000:.1f}km",
      total_price=total_price,
    )

  async def _enrich_destination(
    self,
    destination: DestinationInput,
    index: int,
    budget: int,
  ) -> SpotResult:
    nearby = await self.spot_search.search(
      destination.lat,
      destination.lng,
      radius_km=0.8,
      budget=budget,
    )
    price_est = 0
    category = "sightseeing"
    rating = 4.0
    review_count = 0
    image_url = None
    hours = None
    url = None
    source_id = f"dest-{index}"

    if nearby:
      best = max(nearby, key=lambda s: (s.rating, s.review_count, -s.price))
      price_est = best.price or min(max(budget // 4, 1000), 4000)
      category = best.category or category
      rating = best.rating or rating
      review_count = best.review_count
      image_url = best.image_url
      hours = best.hours
      url = best.url
    elif budget > 0:
      price_est = min(max(budget // 4, 1000), 4000)

    return SpotResult(
      id=source_id,
      name=destination.name,
      lat=destination.lat,
      lng=destination.lng,
      price=price_est,
      rating=rating,
      review_count=review_count,
      source="user",
      category=category,
      address=destination.name,
      image_url=image_url,
      hours=hours,
      url=url,
    )

  async def _order_mandatory_from_start(
    self,
    start_lat: float,
    start_lng: float,
    mandatory: list[SpotResult],
  ) -> list[SpotResult]:
    if len(mandatory) <= 1:
      return mandatory

    coords = [(start_lat, start_lng)] + [(s.lat, s.lng) for s in mandatory]
    order = await self._greedy_order(coords)
    return [mandatory[i - 1] for i in order if i > 0]

  async def _search_along_route(
    self,
    start_lat: float,
    start_lng: float,
    ordered_mandatory: list[SpotResult],
    categories: list[str],
    budget: int,
    exclude: list[SpotResult],
  ) -> list[SpotResult]:
    fillers: list[SpotResult] = []
    prev_lat, prev_lng = start_lat, start_lng

    for dest in ordered_mandatory:
      route = await self.router.get_route(prev_lat, prev_lng, dest.lat, dest.lng)
      geometry = route.get("geometry") or []
      sample_points = self._sample_route_points(
        geometry, prev_lat, prev_lng, dest.lat, dest.lng, interval_km=0.4
      )

      for lat, lng in sample_points:
        for category in categories:
          spots = await self.spot_search.search(
            lat=lat,
            lng=lng,
            radius_km=0.8,
            category=category,
            budget=budget,
          )
          fillers.extend(spots)

      prev_lat, prev_lng = dest.lat, dest.lng

    return self._dedupe(fillers, exclude)

  def _sample_route_points(
    self,
    geometry: list[list[float]],
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    interval_km: float = 0.6,
  ) -> list[tuple[float, float]]:
    if geometry and len(geometry) >= 2:
      points = [(coord[1], coord[0]) for coord in geometry]
    else:
      points = [(from_lat, from_lng), (to_lat, to_lng)]

    samples: list[tuple[float, float]] = []
    for i in range(len(points) - 1):
      lat1, lng1 = points[i]
      lat2, lng2 = points[i + 1]
      seg_len = _haversine_km(lat1, lng1, lat2, lng2)
      steps = max(1, int(seg_len / interval_km))
      for step in range(steps):
        t = step / steps
        samples.append((lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)))

    samples.append(points[-1])
    return samples

  def _interleave_route_stops(
    self,
    start_lat: float,
    start_lng: float,
    mandatory: list[SpotResult],
    fillers: list[SpotResult],
    max_per_leg: int = 1,
    max_total: int = 4,
  ) -> list[SpotResult]:
    result: list[SpotResult] = []
    used_keys: set[tuple[str, float, float]] = set()
    filler_count = 0
    prev_lat, prev_lng = start_lat, start_lng

    for dest in mandatory:
      leg_fillers: list[SpotResult] = []
      for filler in fillers:
        key = (filler.name, round(filler.lat, 4), round(filler.lng, 4))
        if key in used_keys:
          continue
        dist = _distance_to_segment_km(
          filler.lat, filler.lng, prev_lat, prev_lng, dest.lat, dest.lng
        )
        if dist <= 0.65:
          leg_fillers.append(filler)

      for filler in leg_fillers[:max_per_leg]:
        if filler_count >= max_total:
          break
        key = (filler.name, round(filler.lat, 4), round(filler.lng, 4))
        used_keys.add(key)
        result.append(filler)
        filler_count += 1

      result.append(dest)
      prev_lat, prev_lng = dest.lat, dest.lng

    return result

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
    mandatory_ids: set[str],
  ) -> tuple[list[PlanSpotItem], int]:
    current_dt = datetime.combine(datetime.today(), day_start)
    end_dt = datetime.combine(datetime.today(), day_end)
    items: list[PlanSpotItem] = []
    total_price = 0
    prev_lat, prev_lng = start_lat, start_lng
    scheduled_mandatory: set[str] = set()

    for spot in spots:
      route = await self.router.get_route(prev_lat, prev_lng, spot.lat, spot.lng)
      travel_minutes = max(1, int(route["duration"] / 60))
      current_dt += timedelta(minutes=travel_minutes)

      base_stay = STAY_MINUTES.get(spot.category or "", DEFAULT_STAY)
      is_mandatory = spot.id in mandatory_ids
      stay = int(base_stay * stay_multiplier)
      if is_mandatory:
        stay = max(30, stay)
      else:
        stay = min(stay, 50)

      spot_end = current_dt + timedelta(minutes=stay)

      if spot_end > end_dt and not is_mandatory:
        continue
      if spot_end > end_dt and is_mandatory:
        stay = max(20, int((end_dt - current_dt).total_seconds() / 60))
        spot_end = current_dt + timedelta(minutes=stay)

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
          is_user_destination=is_mandatory,
        )
      )
      if is_mandatory:
        scheduled_mandatory.add(spot.id)
      total_price += spot.price
      current_dt = spot_end
      prev_lat, prev_lng = spot.lat, spot.lng

    missing = mandatory_ids - scheduled_mandatory
    if missing:
      raise ValueError(
        "時間内に全ての行きたい場所を回れませんでした。"
        "終了時刻を遅くするか、場所の数を減らしてください。"
      )

    if not items:
      raise ValueError("指定した時間内に収まるプランを作れませんでした。時間帯を広げてください")

    return items, total_price
