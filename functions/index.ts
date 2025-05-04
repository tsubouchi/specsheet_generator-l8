import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'
import algoliasearch from 'algoliasearch'

// 環境変数は Firebase Functions の runtime config に設定
// firebase functions:config:set algolia.app_id="APP_ID" algolia.api_key="API_KEY" algolia.index="specs"
const ALGOLIA_APP_ID = functions.config().algolia?.app_id
const ALGOLIA_API_KEY = functions.config().algolia?.api_key
const ALGOLIA_INDEX_NAME = functions.config().algolia?.index || 'specs'

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.error('Algolia credentials are not set. Index sync is disabled.')
}

const algoliaClient = ALGOLIA_APP_ID && ALGOLIA_API_KEY ? algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY) : null
const algoliaIndex = algoliaClient ? algoliaClient.initIndex(ALGOLIA_INDEX_NAME) : null

admin.initializeApp()

export const onSpecWrite = functions.region('asia-northeast1').firestore
  .document('specs/{docId}')
  .onWrite(async (change, context) => {
    if (!algoliaIndex) return

    const docId = context.params.docId as string

    // 削除時 → Algolia からも削除
    if (!change.after.exists) {
      await algoliaIndex.deleteObject(docId)
      return
    }

    // 追加 or 更新 → upsert
    const data = change.after.data() as any
    const record = {
      objectID: docId,
      uid: data.uid ?? null,
      productIdea: data.productIdea ?? '',
      spec: data.spec ?? '',
      createdAt: data.createdAt ? data.createdAt.toDate().getTime() : Date.now(),
    }
    await algoliaIndex.saveObject(record)
  }) 