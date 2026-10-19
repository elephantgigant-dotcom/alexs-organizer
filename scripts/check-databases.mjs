// READ-ONLY check: lists every collection (and sub-collection under users/*) with document
// counts in both Firestore databases. Writes nothing. Run by .github/workflows/check-databases.yml.

import { createRequire } from 'node:module'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp({ projectId: 'alexs-organizer' })

for (const id of ['(default)', 'alexs-organizer']) {
  const db = getFirestore(id)
  console.log(`\n=== Database ${id} ===`)
  try {
    const cols = await db.listCollections()
    if (!cols.length) console.log('EMPTY: no collections, no documents')
    for (const col of cols) {
      const n = (await col.count().get()).data().count
      console.log(`${col.id}: ${n} documents`)
      const docs = await col.listDocuments()
      for (const d of docs) {
        for (const sub of await d.listCollections()) {
          const m = (await sub.count().get()).data().count
          console.log(`  ${col.id}/${d.id}/${sub.id}: ${m} documents`)
        }
      }
    }
  } catch (e) {
    console.log(`Could not read: ${e.message}`)
  }
}
