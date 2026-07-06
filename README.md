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

## API キー

[docs/API_KEYS.md](docs/API_KEYS.md) を参照。未取得時はモックモードで動作します。
