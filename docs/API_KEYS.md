# API キー取得手順

本アプリは HotPepper / Yahoo ローカルサーチ API を利用できます。キー取得前は `MOCK_MODE=true` でモックデータが使われます。

## HotPepper グルメサーチ API

1. [リクルート Webサービス](https://webservice.recruit.co.jp/) にアクセス
2. アカウントを作成しログイン
3. 「グルメサーチAPI」を選択して利用申請
4. 発行された API キーを `backend/.env` の `HOTPEPPER_API_KEY` に設定

## Yahoo! ローカルサーチ API

1. [Yahoo!デベロッパーネットワーク](https://developer.yahoo.co.jp/) にアクセス
2. アプリケーションを登録
3. Client ID（App ID）を `backend/.env` の `YAHOO_APP_ID` に設定

## 店名・レストラン名の検索

### すぐ使える店名（APIキー不要）

「もうもう亭」など、主要店舗はアプリ内データで検索できます。候補から店舗を選んでください。

### より多くの店名を検索する（HotPepper API・無料）

HotPepper または Yahoo API キーを設定すると、全国の飲食店名を検索できます。

1. [リクルート Webサービス](https://webservice.recruit.co.jp/) でアカウント作成
2. 「グルメサーチAPI」を利用申請
3. 発行された API キーを設定:

```powershell
cd c:\Users\rden3\date-planner
.\scripts\set_hotpepper_key.ps1 -Key "あなたのAPIキー"
```

または `backend/.env` を直接編集:

```env
HOTPEPPER_API_KEY=あなたのAPIキー
```

4. バックエンドを再起動

## 実 API への切替

`backend/.env` を編集:

```env
HOTPEPPER_API_KEY=your_key_here
YAHOO_APP_ID=your_app_id_here
MOCK_MODE=false
```

バックエンドを再起動してください。

## 注意事項

- HotPepper API は利用規約・1日あたりのリクエスト上限を確認してください
- Yahoo API も同様に利用上限があります
- Nominatim（ジオコーディング）は公開サーバ利用時 1 秒 1 リクエストの制限があります
- OSRM は `docker compose up` で起動。未起動時は距離計算がハバースイン近似にフォールバックします
