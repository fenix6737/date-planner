from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import models  # noqa: F401
from app.routers import generate, geocode, plans, route, spots

app = FastAPI(title="Date Planner API", version="1.0.0")


@app.on_event("startup")
def on_startup():
  Base.metadata.create_all(bind=engine)

app.add_middleware(
  CORSMiddleware,
  allow_origins=settings.cors_origin_list,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

app.include_router(geocode.router)
app.include_router(spots.router)
app.include_router(route.router)
app.include_router(generate.router)
app.include_router(plans.router)


@app.get("/health")
def health():
  return {"status": "ok"}
