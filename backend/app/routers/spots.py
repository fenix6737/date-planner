from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.schemas import RouteResponse, SpotResult
from app.services.router import RouterService
from app.services.spot_search import SpotSearchService

router = APIRouter(prefix="/api", tags=["spots"])


@router.get("/searchSpots", response_model=list[SpotResult])
async def search_spots(
  lat: float = Query(...),
  lng: float = Query(...),
  radius: float = Query(3.0, alias="radius"),
  category: Optional[str] = None,
  budget: Optional[int] = None,
):
  service = SpotSearchService()
  return await service.search(lat=lat, lng=lng, radius_km=radius, category=category, budget=budget)


@router.get("/spotInfo", response_model=SpotResult)
async def spot_info(
  id: str = Query(..., alias="id"),
  source: Optional[str] = None,
  name: Optional[str] = None,
  lat: Optional[float] = None,
  lng: Optional[float] = None,
):
  service = SpotSearchService()
  spot = await service.get_spot_info(id, source, name=name, lat=lat, lng=lng)
  if not spot:
    raise HTTPException(status_code=404, detail="店舗が見つかりません")
  return spot
