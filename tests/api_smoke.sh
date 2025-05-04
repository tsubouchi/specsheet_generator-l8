#!/usr/bin/env bash
set -euo pipefail

# jq チェック
if ! command -v jq &>/dev/null; then
  echo 'jq がインストールされていません。brew install jq などで導入してください';
  exit 1
fi

# BASE は必須
: "${BASE?Need BASE env}"

# Firebase ID Token 取得
if [[ -n "${ID_TOKEN:-}" ]]; then
  echo "Using pre-set ID_TOKEN" >&2
else
  : "${EMAIL?Need EMAIL env}" "${PASSWORD?Need PASSWORD env}" "${FIREBASE_API_KEY?Need FIREBASE_API_KEY env}"
  login_json=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d '{"email":"'${EMAIL}'","password":"'${PASSWORD}'","returnSecureToken":true}' \
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}")
  ID_TOKEN=$(echo "$login_json" | jq -r .idToken)
  if [[ "$ID_TOKEN" == "null" ]]; then
    echo "Firebase REST API でのログインに失敗しました: $login_json" >&2
    exit 1
  fi
fi

# エンドポイント一覧
endpoints=(
  generate
  "search?type=text&q=ping"
  history
)

for ep in "${endpoints[@]}"; do
  printf '\n=== %s ===\n' "$ep"
  curl -s -o /dev/null -w "Status:%{http_code}\n" \
    "$BASE/api/$ep" \
    -H "Authorization: Bearer $ID_TOKEN" || true
done

# drive-upload (オプション)
if [[ -n "${DRIVE_TOKEN:-}" ]]; then
  printf '\n=== drive-upload ===\n'
  curl -s -o /dev/null -w "Status:%{http_code}\n" \
    "$BASE/api/drive-upload" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -d '{"markdown":"# smoke","driveAccessToken":"'${DRIVE_TOKEN}'"}' || true
fi

echo "\nSmoke tests finished" 