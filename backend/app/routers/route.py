from fastapi import APIRouter, HTTPException, Query

from app.schemas.schemas import RouteResponse
from app.services.router import RouterService

router = APIRouter(prefix="/api", tags=["route"])


@router.get("/getRoute", response_model=RouteResponse)
async def get_route(
  fromLat: float = Query(...),
  fromLng: float = Query(...),
  toLat: float = Query(...),
  toLng: float = Query(...),
  mode: str = Query("foot"),
):
  if mode not in ("foot", "car"):
    raise HTTPException(status_code=400, detail="パラメータが不正です")
  service = RouterService()
  try:
    result = await service.get_route(fromLat, fromLng, toLat, toLng, mode)
    return RouteResponse(**result)
  except Exception as exc:
    raise HTTPException(status_code=500, detail="ルート算出失敗") from exc
