import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

DEST_SHIBUYA = {"name": "代々木公園", "lat": 35.6717, "lng": 139.6949}
DEST_MEIJI = {"name": "明治神宮", "lat": 35.6764, "lng": 139.6993}


@pytest.mark.anyio
async def test_generate_plan_success():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.post(
      "/api/generatePlan",
      json={
        "start": {"lat": 35.6595, "lng": 139.7004},
        "date": "2026-07-05",
        "budget": 5000,
        "time_start": "10:00",
        "time_end": "18:00",
        "route_style": "relaxed",
        "destinations": [DEST_SHIBUYA],
        "gender": "M",
      },
    )
  assert response.status_code == 200
  data = response.json()
  assert len(data["plan"]) > 0
  assert data["total_price"] <= 5000


@pytest.mark.anyio
async def test_generate_plan_missing_params():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.post(
      "/api/generatePlan",
      json={
        "start": {"lat": 35.6595, "lng": 139.7004},
        "date": "2026-07-05",
        "budget": 0,
        "time_start": "10:00",
        "time_end": "18:00",
        "route_style": "relaxed",
        "destinations": [],
      },
    )
  assert response.status_code == 400


@pytest.mark.anyio
async def test_generate_plan_insufficient_candidates():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.post(
      "/api/generatePlan",
      json={
        "start": {"lat": 35.6595, "lng": 139.7004},
        "date": "2026-07-05",
        "budget": 5000,
        "time_start": "18:00",
        "time_end": "10:00",
        "route_style": "relaxed",
        "destinations": [DEST_SHIBUYA],
      },
    )
  assert response.status_code == 500
  assert "終了時刻" in response.json()["detail"]


@pytest.mark.anyio
async def test_suggest_all_prefectures_on_empty():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.get("/api/suggest", params={"q": "", "limit": 47})
  assert response.status_code == 200
  data = response.json()
  assert len(data) == 47


@pytest.mark.anyio
async def test_suggest_ward_and_city():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    for query in ("渋谷区", "横浜市", "大阪市北区", "北海道"):
      response = await client.get("/api/suggest", params={"q": query})
      assert response.status_code == 200
      data = response.json()
      assert len(data) > 0, f"No suggestions for {query}"


@pytest.mark.anyio
async def test_suggest_amagasaki():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.get("/api/suggest", params={"q": "尼崎市"})
  assert response.status_code == 200
  data = response.json()
  assert len(data) > 0
  assert any("尼崎" in item["name"] or "尼崎" in item["address"] for item in data)


@pytest.mark.anyio
async def test_suggest_moumoutei():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.get("/api/suggest", params={"q": "もうもう亭"})
  assert response.status_code == 200
  data = response.json()
  assert len(data) > 0
  assert any("もうもう亭" in item["name"] for item in data)


@pytest.mark.anyio
async def test_geocode_moumoutei():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.get("/api/geocode", params={"q": "もうもう亭"})
  assert response.status_code == 200
  data = response.json()
  assert "もうもう亭" in data["address"] or "名古屋" in data["address"]


@pytest.mark.anyio
async def test_geocode_ward():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    response = await client.get("/api/geocode", params={"q": "渋谷区"})
  assert response.status_code == 200
  data = response.json()
  assert data["lat"] > 35
  assert "渋谷" in data["address"]


@pytest.mark.anyio
async def test_saved_plan_retrieval():
  async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
    save_response = await client.post(
      "/api/plans",
      json={
        "date": "2026-07-05",
        "start_lat": 35.6595,
        "start_lng": 139.7004,
        "budget": 5000,
        "preferences": {"route_style": "relaxed"},
        "total_time": "10:00-18:00",
        "total_distance": "5.0km",
        "total_price": 1000,
        "items": [
          {
            "name": "テストカフェ",
            "lat": 35.66,
            "lng": 139.70,
            "time": "10:00-11:00",
            "budget_est": 1000,
            "rating": 4.0,
            "review_count": 50,
            "category": "cafe",
            "source": "mock",
            "source_id": "test-1",
          }
        ],
      },
    )
    assert save_response.status_code == 200
    plan_id = save_response.json()["id"]

    get_response = await client.get(f"/api/plans/{plan_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["items"][0]["spot"]["name"] == "テストカフェ"
