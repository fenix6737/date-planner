# 本番デプロイ手順（Render）

## 1. GitHub にプッシュ

```bash
cd c:\Users\rden3\date-planner
git add .
git commit -m "Add production deployment config"
git push -u origin main
```

## 2. Render でデプロイ

1. [Render Dashboard](https://dashboard.render.com/) にログイン
2. **New** → **Blueprint**
3. このリポジトリを接続
4. `render.yaml` が自動検出される
5. 環境変数 `HOTPEPPER_API_KEY` に API キーを入力
6. **Apply** でデプロイ開始

## 3. デプロイ後の URL

| サービス | URL |
|---------|-----|
| フロント | https://dateplanner-web.onrender.com |
| API | https://dateplanner-api.onrender.com |
| ヘルスチェック | https://dateplanner-api.onrender.com/health |

## 4. 注意

- 無料プランは 15 分アイドルでスリープします（初回アクセスに 30 秒程度）
- CORS は `render.yaml` の `CORS_ORIGINS` にフロント URL を設定済み
- シークレット（API キー）は Render ダッシュボードで設定し、Git に含めない

## ローカル Docker ビルド確認

```bash
cd backend
docker build -t dateplanner-api .
docker run -p 8000:8000 -e MOCK_MODE=false dateplanner-api

cd ../frontend
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000 -t dateplanner-web .
docker run -p 3000:3000 dateplanner-web
```
