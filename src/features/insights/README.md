# Insights: extension point (not built yet)

Where an automated weekly Claude report will plug in later. Nothing here calls an AI today.

What already exists to build on:
- **Weekly backup**: the scheduled Cloud Function `weeklyBackup` (functions/index.js, Monday 00:30
  Europe/Warsaw) writes `users/{uid}/weeklySummaries/{monday}` using `functions/summary.js`:
  tasks planned / done / completion rate, mood, energy, day rating (1–10), check-in counts,
  sleep (nights, minutes, calculated + device score, cycles, deep / REM %, quality, bedtime),
  meditation sessions and minutes, stars earned and spent.
- **Export**: More → Export downloads JSON + CSV. The JSON starts with `analysisBrief`
  (`ANALYSIS_BRIEF` in `src/lib/export.js`), which tells Claude what to analyse.

How to add the weekly report later:
1. Add a Cloud Function triggered when a `weeklySummaries/{weekKey}` doc is created
   (`onDocumentCreated({ document: 'users/{uid}/weeklySummaries/{week}', database: 'alexs-organizer' })`).
2. Send that summary plus `ANALYSIS_BRIEF` (copy it into functions/shared with
   `npm run sync:shared`) to the Claude API. Keep the API key as a Functions secret
   (`firebase functions:secrets:set ANTHROPIC_API_KEY`), never in the app.
3. Write the answer to `users/{uid}/insights/{weekKey}` = `{ text, createdAt, model }`
   (allow read in firestore.rules, write only by the server) and show it on the Weekly review screen.
