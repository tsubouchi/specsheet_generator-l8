import algoliasearch from "algoliasearch"

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "specs"

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.warn("Algolia 環境変数が未設定です。全文検索は無効化されます。")
}

export const algoliaIndex = ALGOLIA_APP_ID && ALGOLIA_API_KEY
  ? algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY).initIndex(ALGOLIA_INDEX_NAME)
  : null 