# API テスト TODO (curl 一括検証スクリプト)

本ドキュメントでは Next.js + Cloud Run で公開している **全 API エンドポイント** を
Firebase 認証付き `curl` で自動テストする手順／スクリプトをまとめる。
401 エラーが発生した場合に即座に原因特定できるよう、レスポンスを詳細に表示する。

---
## 0. 変数定義
```bash
# Firebase CLI で取得するカスタムトークン / ID トークン
export EMAIL="test@example.com"
export PASSWORD="password123"

# 認証情報を取得
firebase auth:sign-in-with-email \
  --email "$EMAIL" --password "$PASSWORD" --local > /tmp/firebase_login.json
export ID_TOKEN="$(jq -r .idToken /tmp/firebase_login.json)"

# Google Drive アップロード用アクセストークン (SaveButton のアラートや DevTools から取得)
export DRIVE_TOKEN="ya29.xxx"

# ベース URL
export BASE="https://specsheet-generator-xxxx.run.app"
```

---
## 1. /api/generate ✅
```bash
curl -v "$BASE/api/generate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"productIdea":"AI 画像解析キャッチコピー", "taste":"ポップ", "usage":"LP 見出し"}'
```

### 期待レスポンス
- 200 OK
- JSON `{ markdown: "..." }`

### よくある 401 原因 & 対処
| 状況 | 対応 |
|------|------|
| ID トークン期限切れ | `firebase auth:sign-in-with-email` を再実行 |
| Cloud Run 側で `getAuth()` verify 失敗 | `FIREBASE_PROJECT_ID` が不一致 → `firebase-admin` 初期化確認 |

---
## 2. /api/search ✅
```bash
curl -v "$BASE/api/search?type=text&q=テスト" \
  -H "Authorization: Bearer $ID_TOKEN"
```

---
## 3. /api/history ✅
```bash
curl -v "$BASE/api/history" \
  -H "Authorization: Bearer $ID_TOKEN"
```

---
## 4. /api/drive-upload ✅
```bash
curl -v "$BASE/api/drive-upload" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"markdown":"# hello","driveAccessToken":"'$DRIVE_TOKEN'","public":true}'
```

---
## 5. スモークテスト一括実行スクリプト 🆕
`tests/api_smoke.sh` に以下を保存して `bash tests/api_smoke.sh`
```bash
#!/usr/bin/env bash
set -euo pipefail

endpoints=(
  generate
  "search?type=text&q=ping"
  history
)

for ep in "${endpoints[@]}"; do
  echo "=== $ep ==="
  curl -s -o /dev/null -w "Status:%{http_code}\n" \
    "$BASE/api/$ep" \
    -H "Authorization: Bearer $ID_TOKEN" || true
  echo
done

# drive-upload (skip if no token)
if [[ -n "${DRIVE_TOKEN}" ]]; then
  curl -s -o /dev/null -w "drive-upload Status:%{http_code}\n" \
    "$BASE/api/drive-upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -d '{"markdown":"# smoke","driveAccessToken":"'$DRIVE_TOKEN'"}' || true
fi
```

---
## 6. TODO
| # | タスク | Owner | Status |
|---|--------|-------|--------|
| 1 | Firebase CLI からトークン取得自動化 | ops | ⏳ |
| 2 | GitHub Actions で smoke.sh を定期実行 | ops | ⏳ |
| 3 | 401 エラー時の自動 Slack 通知 | ops | ⏳ |
