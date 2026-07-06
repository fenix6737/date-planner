# Date Planner

1日デートプランを自動生成する Web アプリ（Next.js + FastAPI）。

## 起動手順

### 1. インフラ（任意: PostgreSQL / OSRM）

Docker が使える場合:

```bash
cd c:\Users\rden3\date-planner
docker compose up -d
```

Docker がない場合は SQLite でそのまま動作します（デフォルト設定）。

### 2. バックエンド

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 3. フロントエンド

```bash
cd frontend
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## テスト

```bash
cd backend
pytest tests/ -v
```

## 本番デプロイ

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/fenix6737/date-planner)

詳細は [docs/DEPLOY.md](docs/DEPLOY.md) を参照。

- **GitHub**: https://github.com/fenix6737/date-planner
- **フロント（本番）**: https://dateplanner-web.onrender.com
- **API（本番）**: https://dateplanner-api.onrender.com

デプロイ時に `HOTPEPPER_API_KEY` を Render の環境変数に設定してください。
