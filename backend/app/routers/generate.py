from fastapi import APIRouter, HTTPException

from app.schemas.schemas import GeneratePlanRequest, GeneratePlanResponse
from app.services.plan_generator import PlanGeneratorService

router = APIRouter(prefix="/api", tags=["plans"])


@router.post("/generatePlan", response_model=GeneratePlanResponse)
async def generate_plan(request: GeneratePlanRequest):
  if not request.start or "lat" not in request.start or "lng" not in request.start:
    raise HTTPException(status_code=400, detail="出発地を入力してください")
  if request.budget <= 0:
    raise HTTPException(status_code=400, detail="予算を入力してください")
  if not request.destinations:
    raise HTTPException(status_code=400, detail="行きたい場所を1つ以上入力してください")
  if request.route_style not in ("relaxed", "active", "stylish"):
    raise HTTPException(status_code=400, detail="ルートの雰囲気を選んでください")

  service = PlanGeneratorService()
  try:
    return await service.generate(
      start_lat=float(request.start["lat"]),
      start_lng=float(request.start["lng"]),
      budget=request.budget,
      prefs=request.prefs,
      gender=request.gender,
      time_start=request.time_start,
      time_end=request.time_end,
      route_style=request.route_style,
      destinations=request.destinations,
    )
  except ValueError as exc:
    raise HTTPException(status_code=500, detail=str(exc)) from exc
