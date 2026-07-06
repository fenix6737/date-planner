from typing import Optional

from pydantic import BaseModel


class GeocodeResponse(BaseModel):
    lat: float
    lng: float
    address: str


class SuggestItem(BaseModel):
    name: str
    address: str
    lat: float
    lng: float
