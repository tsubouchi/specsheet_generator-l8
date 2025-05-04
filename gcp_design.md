「Firestore + Firebase MCP で"全文検索＋履歴"を備えた Next.js／Cloud Run アプリ」 を丸ごと構築するための 完全版テクニカル記事兼仕様書 です。

0. ゴールの再確認
	1.	データベース: Cloud Firestore（Native モード）
	2.	検索機能:
	•	キーワード全文検索 → Algolia（または Typesense）インデックス連携
	•	ベクトル類似検索 → Firestore Vector Search Preview（Exact k-NN）
	3.	検索履歴: ユーザー単位で Firestore に自動保存
	4.	AI Agent 連携: Model Context Protocol Server → firebase-mcp を利用し
LLM から firestore_query / firestore_add_document 等ツール呼び出しを可能にする ￼
	5.	フロント: Next.js App Router (app/search, app/history) + Tailwind
	6.	バックエンド: Cloud Run（min-instances = 1, Workload Identity）
	7.	CI / CD: Cloud Build → Artifact Registry → Cloud Run
	8.	品質ゲート: pnpm run lint && pnpm exec tsc --noEmit を pre-build で強制
	9.	仕様書保存: ユーザー Google Drive に Markdown をアップロード（/api/drive-upload）

⸻

1. ハイレベルアーキテクチャ

┌────────────────────┐
│ Next.js (App Router)│
│  ├─ /api/search      │─────┐
│  ├─ /api/history     │     │HTTP
│  ├─ /api/drive-upload│     │
└──┬───────────────────┘     │
   │Node(18) in Cloud Run    │
   │  ├─ Firestore / Algolia │
   │  └─ Drive Upload        │
   ▼                         │
┌──────────────┐          ┌─────────────────────┐
│ Algolia      │◀──sync──▶│ Cloud Firestore     │
│ (Text index) │          │ (Native + Vector)   │
└──────────────┘          └────────┬────────────┘
           ▲                         │
           │                         ▼
           │             ┌─────────────────────┐
           │             │   Google Drive      │
           │             │  (Markdown Files)   │
           │             └─────────────────────┘
                                   ▲
                                   │MCP JSON-RPC
                                   ▼
                          Any LLM / IDE Plugin

2. ディレクトリ構成（抜粋）    

my-app/
├─ app/
│   ├─ page.js
│   ├─ layout.js
│   ├─ api/
│   │   ├─ search/
│   │   │   └─ route.ts     # keyword / vector 検索
│   │   └─ history/
│   │       └─ route.ts     # 履歴取得
│   │   ├─ drive-upload/
│   │   │   └─ route.ts     # Markdown を Drive へアップロード
│   ├─ hooks/
│   │   └─ useAuth.ts       # drive.file スコープ追加
│   ├─ lib/
│   │   ├─ firestore.ts     # Admin 初期化
│   │   ├─ algolia.ts       # 検索クライアント
│   │   ├─ vector.ts        # Firestore vector helpers
│   │   ├─ googleIdentity.ts # GIS アクセストークン取得
│   └─ components/
│       └─ SaveButton.tsx   # Google Drive 保存ボタン
├─ mcp/
│   └─ docker-compose.yaml  # firebase-mcp ローカル実行用
├─ cloudbuild.yaml
└─ Dockerfile                      

3. 検索機能仕様

3-1. キーワード全文検索
	1.	同期:
	•	Firestore の products コレクションに Cloud Functions トリガー (onWrite) を設定。
	•	変更ドキュメントを Algolia / Typesense に upsert。
	2.	検索 API (/api/search?type=text&q=apple):
	1.	Algolia SDK でクエリ
	2.	ヒット ID を Firestore で in 取得（権限制御用）
	3.	所要コスト: 10K レコードなら Algolia Free Tier で月 100 K Ops まで無料。

3-2. 類似検索（ベクトル）
	1.	ベクトル格納:
	•	OpenAI Embeddings (text-embedding-3-large) や Gemini Embeddings をクライアント / Cloud Function で生成。
	•	vectors フィールドに Float32Array (最大 256 D) を保存。
	2.	クエリ (/api/search?type=vector&q=...):

await firestore.collection("products")
  .select("__name__")          // 転送量削減
  .vectorSearch("vectors", queryVector, { k: 12 });	

vectorSearch は Firestore Vector Search Preview で提供される k-NN 拡張 API ￼。

	3.	ランキング: 距離値でソート → しきい値 < 0.4 のみ返却。

⸻

4. 検索履歴（Audit）仕様  

フィールド
型
説明
uid
string
Firebase Auth UID
type
"text" | "vector"
query
string
ts
Timestamp
hits
string[] (docIDs)
latencyMs
number

	•	コレクション名 search_logs/{uid}/items/{autoID}
	•	Retention Policy : 90 days → TTL Index で自動削除
	•	GDPR 対応 : ユーザー削除時に Cloud Function (onDelete(User)) で search_logs/{uid} をパージ。

⸻

5. 仕様書の Google Drive 自動保存

5-1. ゴール
• 生成した Markdown 仕様書を、認証済みユーザー自身の Google Drive に `text/markdown` で保存する。
• Firestore にはファイル URL / Drive ID を履歴として記録。（任意）

5-2. フロントエンド
1) Firebase Google サインイン時に `https://www.googleapis.com/auth/drive.file` スコープを追加。
2) `lib/googleIdentity.ts` で GIS フローから `access_token` を取得し、`POST /api/drive-upload` に送信。
3) `components/SaveButton.tsx` からアップロードをトリガー。

5-3. API `/api/drive-upload`
Request JSON:
```jsonc
{
  "markdown": "# Spec ...",
  "fileName": "specsheet.md",      // 任意、省略時は日付_slug.md
  "driveAccessToken": "ya29..."     // フロントで取得したアクセストークン
}
```
処理フロー:
1. `Authorization: Bearer <Firebase ID Token>` でユーザー検証。
2. `googleapis` ドライブ SDK を `driveAccessToken` で初期化。
3. ユーザー Drive 内に `Specsheet Generator` フォルダ（設定可能）が無ければ作成。
4. Markdown ファイルをアップロードしファイル ID / WebViewLink を取得。
5. レスポンス: `{ id, webViewLink }` を返却。

5-4. セキュリティ
• アクセストークンは Cloud Run 内で保存せず、ログにも残さない。
• Cloud Run サービスアカウントには Drive 権限を付与しない。（ユーザー資格情報のみ使用）

5-5. Cloud Build 追加ステップ
```yaml
- name: 'gcr.io/cloud-builders/npm'
  id: 'install googleapis'
  args: ['install', 'googleapis@^133']
```

5-6. テスト手順（curl）
```bash
TOKEN="$(firebase auth:sign-in-with-email ... | jq -r .accessToken)"
ID="$(firebase auth:sign-in-with-email ... | jq -r .idToken)"
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID" \
  -d '{"markdown":"# Spec","driveAccessToken":"'$TOKEN'"}' \
  https://specsheet-generator-xxxx.run.app/api/drive-upload
```

⸻

6. Cloud Run & Workload Identity 設定抜粋

gcloud run deploy spec-search \
  --image=$IMAGE_URI \
  --service-account=$RUN_SA \
  --min-instances=1 \
  --cpu=2 --memory=1Gi \
  --execution-environment gen2 \
  --update-secrets GOOGLE_API_KEY=projects/$PROJECT_NUM/secrets/GOOGLE_API_KEY:latest

	•	roles/datastore.user, roles/secretmanager.secretAccessor を $RUN_SA に付与。
	•	ビルドは Cloud Build SA に roles/iam.serviceAccountUser ￼。

⸻

7. 仕様書 → TODO リスト自動生成 Tips（再掲＋α）
	1.	Markdown 見出し → GitHub Issue へマッピング
	2.	レベル３粒度（1 日以内タスク）でリスト化
	3.	Front Matter に priority, owner, blockedBy を YAML で書く
	4.	gh api + GitHub Actions で 60 s 以内に Project Board 生成
	5.	AI Agent (Planner) が週次で重複・優先度再計算

⸻

8. 完全 TODO リスト（雛形）  

- [ ] ✅ Enable APIs (run, secretmanager, firestore...)
- [ ] ✅ Create RUN_SA & set IAM roles
- [ ] ✅ Push Algolia credentials to Secret Manager
- [ ] 🆕 Write Cloud Functions syncFirestoreToAlgolia
- [ ] 🆕 Build vectorEmbed() utility & batch backfill
- [ ] 🆕 /api/search route (text | vector branch)
- [ ] 🆕 /api/history route + auth middleware
- [ ] 🆕 React SearchBar component (debounce 400 ms)
- [ ] 🆕 Tailwind CardList for results
- [ ] 🆕 MCP docker-compose for local dev
- [ ] ✅ GitHub Actions: lint → typecheck → docker-build
- [ ] ❌ E2E Cypress tests (mobile viewport)  ← Phase-2

9. 用語集（Firestore / Search / MCP）
	•	Algolia: SaaS 検索エンジン。Firestore とは非同期同期。
	•	Vector Search Preview: Firestore にベクトル列を持たせて k-NN 検索する機能（Preview） ￼
	•	TTL Index: 指定フィールド時刻経過で自動ドキュメント削除。2024 Q4 GA。
	•	firebase-mcp: Model Context Protocol Server for Firebase（Firestore / Storage / Auth） ￼
	•	Workload Identity: サービスアカウント鍵レス認証。Cloud Run では必須。
	•	search_logs: 本稿で定義したユーザー別検索履歴コレクション。
	•	Exact k-NN: 内積距離で厳密に最近傍を求める方式。Firestore Vector Search が採用。
	•	firestore_query_collection_group: MCP ツールでサブコレクション横断クエリを実行する ￼。

⸻

10. AI Agent 開発の極意（ダイジェスト）
	1.	単能工 × 監督 の２階層アーキテクチャ
	2.	ReAct + RAG で失敗時に Reflection → プロンプト自己更新
	3.	LLM 出力は JSON Schema バリデーション
	4.	5 000 トークン上限 を越えないよう Tool 分割
	5.	失敗率が閾値超過→ 人間レビューへフォールバック
	6.	Action-Outcome ログを Firestore に蓄積しベクトル化、次回同種タスクのコンテキストとして埋め込む

⸻

11. まとめ
	•	検索体験: Algolia + Firestore Vector Search のハイブリッドで UX と精度を両立
	•	履歴管理: Firestore + TTL で GDPR／分析ニーズを両取り
	•	AI 連携: firebase-mcp が LLM ↔ Firebase のブリッジとなり開発速度を 10× 向上
	•	品質保証: pnpm lint && tsc --noEmit と Cloud Build Gate で「壊れたコードはデプロイさせない」
	•	TODO 自動化: 仕様書を書いた瞬間にタスクが Issue 化 → ボード化 → Agent が実行

このレシピを踏襲すれば、
「検索できる」「履歴が残る」「AI が更新する」 SaaS の基本骨格を 30 日 で本番投入できます。

ぜひ自社プロダクトにコピー＆ペーストし、明日から "仕様書が動き出す" 開発サイクルを体感してください。
