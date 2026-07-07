from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.geocode import GeocodeResponse, SuggestItem
from app.services.geocoder import GeocoderService

router = APIRouter(prefix="/api", tags=["geocode"])


@router.get("/suggest", response_model=list[SuggestItem])
async def suggest_places(
  q: str = Query("", min_length=0),
  nearLat: Optional[float] = None,
  nearLng: Optional[float] = None,
  limit: int = Query(20, ge=1, le=47),
  areasOnly: bool = False,
  prefecture: Optional[str] = None,
  db: Session = Depends(get_db),
):
  service = GeocoderService(db)
  results = await service.suggest(
    q,
    near_lat=nearLat,
    near_lng=nearLng,
    limit=limit,
    areas_only=areasOnly,
    prefecture=prefecture,
  )
  return [SuggestItem(**r) for r in results]


@router.get("/reverseGeocode", response_model=GeocodeResponse)
async def reverse_geocode(
  lat: float = Query(...),
  lng: float = Query(...),
  db: Session = Depends(get_db),
):
  service = GeocoderService(db)
  result = await service.reverse_geocode(lat, lng)
  return GeocodeResponse(**result)


@router.get("/geocode", response_model=GeocodeResponse)
async def geocode(
  q: str = Query(..., min_length=1),
  nearLat: Optional[float] = None,
  nearLng: Optional[float] = None,
  db: Session = Depends(get_db),
):
  if not q.strip():
    raise HTTPException(status_code=400, detail="場所名を入力してください")
  service = GeocoderService(db)
  try:
    result = await service.geocode(q, near_lat=nearLat, near_lng=nearLng)
    return GeocodeResponse(**result)
  except LookupError as exc:
    raise HTTPException(status_code=404, detail=str(exc)) from exc
  except Exception as exc:
    raise HTTPException(status_code=500, detail="場所の検索に失敗しました。もう一度お試しください") from exc
