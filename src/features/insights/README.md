# Insights: extension point (not built yet)

Where an automated weekly Claude report will plug in later. Nothing here calls an AI today.

What already exists to build on (stage 4):
- **Weekly backup**: a scheduled Cloud Function writes `users/{uid}/weeklySummaries/{weekKey}`
  (week starts Monday, Europe/Warsaw): tasks done / planned, completion rate, per-category counts,
  streaks, mood / energy / sleep averages, meditation minutes, stars earned and spent.
- **Export**: Settings → Export downloads JSON + CSV. The JSON starts with an `analysisBrief`
  that tells Claude what to look at.

How to add the weekly report later:
1. Add a Cloud Function triggered when a `weeklySummaries/{weekKey}` doc is created.
2. Send that summary (plus the `analysisBrief` from `src/services/export.js`) to the Claude API.
   Store the API key as a Functions secret, never in the app.
3. Write the answer to `users/{uid}/insights/{weekKey}` = `{ text, createdAt, model }`
   and show it on the Weekly review screen.
