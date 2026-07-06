from datetime import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.db.session import get_db
from app.models.models import Category, Plan, PlanItem, Spot
from app.schemas.schemas import PlanItemResponse, PlanResponse, SavePlanRequest, SavePlanResponse, SpotResult

router = APIRouter(prefix="/api", tags=["plans"])


def _parse_time(value: str) -> time:
  parts = value.split(":")
  return time(int(parts[0]), int(parts[1]))


def _plan_to_response(plan: Plan) -> PlanResponse:
  items = []
  for item in sorted(plan.items, key=lambda x: x.sequence):
    spot = item.spot
    items.append(
      PlanItemResponse(
        sequence=item.sequence,
        start_time=item.start_time.strftime("%H:%M"),
        end_time=item.end_time.strftime("%H:%M"),
        spot=SpotResult(
          id=str(spot.id),
          name=spot.name,
          address=spot.address,
          lat=spot.lat,
          lng=spot.lng,
          price=spot.avg_price,
          rating=spot.rating,
          review_count=spot.review_count,
          source=spot.source,
          category=spot.category.name if spot.category else None,
          image_url=spot.image_url,
          hours=spot.hours,
          url=spot.url,
        ),
      )
    )
  return PlanResponse(
    id=plan.id,
    date=plan.date,
    start_lat=plan.start_lat,
    start_lng=plan.start_lng,
    budget=plan.budget,
    preferences=plan.preferences or {},
    share_token=plan.share_token,
    total_time=plan.total_time,
    total_distance=plan.total_distance,
    total_price=plan.total_price,
    items=items,
  )


@router.get("/plans/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
  plan = (
    db.query(Plan)
    .options(joinedload(Plan.items).joinedload(PlanItem.spot).joinedload(Spot.category))
    .filter(Plan.id == plan_id)
    .first()
  )
  if not plan:
    raise HTTPException(status_code=404, detail="プランが見つかりません")
  return _plan_to_response(plan)


@router.get("/plans/share/{token}", response_model=PlanResponse)
def get_plan_by_share(token: str, db: Session = Depends(get_db)):
  plan = (
    db.query(Plan)
    .options(joinedload(Plan.items).joinedload(PlanItem.spot).joinedload(Spot.category))
    .filter(Plan.share_token == token)
    .first()
  )
  if not plan:
    raise HTTPException(status_code=404, detail="プランが見つかりません")
  return _plan_to_response(plan)


@router.post("/plans", response_model=SavePlanResponse)
def save_plan(request: SavePlanRequest, db: Session = Depends(get_db)):
  plan = Plan(
    date=request.date,
    start_lat=request.start_lat,
    start_lng=request.start_lng,
    budget=request.budget,
    preferences=request.preferences,
    total_time=request.total_time,
    total_distance=request.total_distance,
    total_price=request.total_price,
  )
  db.add(plan)
  db.flush()

  for idx, item in enumerate(request.items):
    category = None
    if item.category:
      category = db.query(Category).filter(Category.name == item.category).first()
      if not category:
        category = Category(name=item.category)
        db.add(category)
        db.flush()

    spot = Spot(
      name=item.name,
      category_id=category.id if category else None,
      lat=item.lat,
      lng=item.lng,
      avg_price=item.budget_est,
      rating=item.rating,
      source=item.source,
      source_id=item.source_id,
      address=item.address,
      image_url=item.image_url,
      hours=item.hours,
      url=item.url,
    )
    db.add(spot)
    db.flush()

    start_str, end_str = item.time.split("-")
    plan_item = PlanItem(
      plan_id=plan.id,
      spot_id=spot.id,
      sequence=idx + 1,
      start_time=_parse_time(start_str),
      end_time=_parse_time(end_str),
    )
    db.add(plan_item)

  db.commit()
  db.refresh(plan)

  return SavePlanResponse(
    id=plan.id,
    share_token=plan.share_token,
    share_url=f"/plans/share/{plan.share_token}",
  )
