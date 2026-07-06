from datetime import date, time
from typing import Any, Optional

from pydantic import BaseModel, Field


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    address: str


class SpotResult(BaseModel):
    id: Optional[str] = None
    name: str
    address: Optional[str] = None
    lat: float
    lng: float
    price: int = 0
    rating: float = 0.0
    review_count: int = 0
    source: str = "mock"
    category: Optional[str] = None
    image_url: Optional[str] = None
    hours: Optional[str] = None
    url: Optional[str] = None


class RouteResponse(BaseModel):
    distance: float
    duration: float
    geometry: list[list[float]]


class PlanSpotItem(BaseModel):
    spot_id: Optional[int] = None
    name: str
    lat: float
    lng: float
    time: str
    budget_est: int
    rating: float = 0.0
    review_count: int = 0
    category: Optional[str] = None
    source: str = "mock"
    source_id: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    hours: Optional[str] = None
    url: Optional[str] = None
    is_user_destination: bool = False


class DestinationInput(BaseModel):
    name: str
    lat: float
    lng: float


class GeneratePlanRequest(BaseModel):
    start: dict[str, float] = Field(..., description="lat/lng of start location")
    date: date
    budget: int
    time_start: str = "09:00"
    time_end: str = "21:00"
    route_style: str = "relaxed"
    destinations: list[DestinationInput] = Field(default_factory=list)
    prefs: dict[str, Any] = Field(default_factory=dict)
    gender: Optional[str] = None


class GeneratePlanResponse(BaseModel):
    plan: list[PlanSpotItem]
    total_time: str
    total_distance: str
    total_price: int


class SavePlanRequest(BaseModel):
    date: date
    start_lat: float
    start_lng: float
    budget: int
    preferences: dict[str, Any] = Field(default_factory=dict)
    total_time: str
    total_distance: str
    total_price: int
    items: list[PlanSpotItem]


class PlanItemResponse(BaseModel):
    sequence: int
    start_time: str
    end_time: str
    spot: SpotResult

    model_config = {"from_attributes": True}


class PlanResponse(BaseModel):
    id: int
    date: date
    start_lat: float
    start_lng: float
    budget: int
    preferences: dict[str, Any]
    share_token: str
    total_time: Optional[str]
    total_distance: Optional[str]
    total_price: int
    items: list[PlanItemResponse] = []

    model_config = {"from_attributes": True}


class SavePlanResponse(BaseModel):
    id: int
    share_token: str
    share_url: str
