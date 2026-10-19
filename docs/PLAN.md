# Plan: data structure and screens

## Rules
- Single user. Everything lives under `users/{uid}/…`; `firestore.rules` lets in only
  `elephantgigant@gmail.com` (verified) and only its own `uid`.
- Calendar dates are **date keys** `YYYY-MM-DD` in **Europe/Warsaw** (`src/lib/dates.js`);
  times are `HH:MM`. Weeks start on **Monday**; a week's id is its Monday's key.
- All database reads and writes live in `src/services/` only.
- Stars are paid through **star events with fixed ids** (`task_<id>`, `checkin_<date>_<type>`,
  `meditation_<id>`, `streak_<kind>_<date>`), written in the same batch as the balance change.
  The rules make star events **create-only**, so paying the same thing twice is rejected and the
  whole batch (balance included) fails: nothing can pay twice, even offline or on two devices.
- Streak bonus: when the first task / check-in / meditation of a day makes a streak reach a
  multiple of "every N days" (default 7), +bonus (default 10). Values editable in Settings.
- **Every rating is a whole number 1–10** (mood, energy, sleep quality, day rating). Charts use a
  1–10 axis; averages show one decimal. Task stars stay 1–5 (effort, not a rating).

## Firestore
Database: the **named** database `alexs-organizer` in `europe-central2` (Warsaw), used by the app
(`src/firebase-config.js` → `DATABASE_ID`), the rules deploy (`firebase.json`) and the Cloud Functions.
The `(default)` database is not used.

```
users/{uid}                     profile + settings
  email, balance (stars), createdAt
  settings: {
    theme: 'system' | 'light' | 'dark',
    stars: { meditation: 5, checkin: 2, streakBonus: 10, streakEvery: 7 },
    meditation: { morningMin: 10, eveningMin: 10 },          // 5–30
    sleep: { targetMin: 450, deepRange: [13, 23], remRange: [20, 25] },  // for the sleep score
    pin: { hash, salt, iterations, length } | null,          // PBKDF2 (Web Crypto)
    autoLockMin: 5,
    notifications: {
      taskDue: true, morningCheckin: true, eveningCheckin: true, meditation: true, weeklyReview: true,
      morningCheckinTime: '07:30', eveningCheckinTime: '21:30',
      morningMeditationTime: '07:45', eveningMeditationTime: '21:45',
      weeklyReviewTime: '19:00',                              // Sundays
      taskLeadMin: 15,                                        // minutes before a task's time
      quietHours: { enabled: true, start: '22:30', end: '07:00' },
    },
  }

users/{uid}/categories/{id}     name, color (palette slot 1–8), emoji?, order
                                defaults: Learning, Self-development, Health, Work, Personal

users/{uid}/tasks/{id}          title, notes, categoryId, priority: 'low'|'normal'|'high',
                                stars 1–5, date 'YYYY-MM-DD', time 'HH:MM'|null,
                                dueAt (Timestamp, for reminders), recurrence {…} (see recurrence.js),
                                seriesId, status 'open'|'done', completedAt, completedDate,
                                earned (stars paid), notified { due }, createdAt
                                → completing a repeating task creates the next one

users/{uid}/checkins/{date}_{type}   one per day per type (the id enforces it), editable
  type 'morning' (on the wake-up date): mood 1–10, energy 1–10, intentions [3 strings], note,
                  sleep { fellAsleep 'HH:MM', wokeUp 'HH:MM', actualMinutes 0–1440,
                          cycles 0–12, deepPct / remPct / lightPct 0–100, quality 1–10,
                          deviceScore 0–100 }            (every sleep field optional)
  type 'evening': mood 1–10, energy 1–10, dayRating 1–10, wentWell, improve, gratitude, note
  + date, createdAt, updatedAt

users/{uid}/meditations/{id}    slot 'morning'|'evening', date, plannedMin 5–30, startedAt (ms),
                                endsAt (ms, the timer is timestamp-based), remainingMs (while paused),
                                status 'running'|'paused'|'done'|'cancelled', completedAt, stars

users/{uid}/starEvents/{id}     amount (+/−), type 'task'|'checkin'|'meditation'|'streak'|'redeem'|'undo',
                                refId, note, date, createdAt

users/{uid}/rewards/{id}        title, emoji, price          default: "Play a video game I want" = 500
users/{uid}/goals/{id}          title, target (stars earned), period 'week'|'month'|'custom',
                                from?, to?  (progress = stars earned in that period)

users/{uid}/devices/{id}        push token per device (Pixel, desktop)
users/{uid}/pushTests/{id}      "send me a test notification"
users/{uid}/weeklySummaries/{weekMonday}   written by the server only: the weekly backup
                                (Cloud Function weeklyBackup, Monday 00:30 Warsaw, functions/summary.js)
```

## Screens (bottom menu: Today · Week · Stars · Stats · More)
1. **Login**: Google only. Another account → "This app is private".
2. **PIN**: set up (4–6 digits), unlock screen, Forgot PIN → Google sign-in again.
3. **Today**: date, star balance, morning check-in + meditation cards (evening ones after 17:00),
   last night's sleep score card, today's tasks with progress, overdue tasks, + button.
4. **Task sheet** (bottom sheet): title, notes, category, date, time, priority, stars 1–5, repeat.
5. **Week**: Monday–Sunday strip with task counts, tasks grouped per day, previous / next week.
6. **Check-in** (morning / evening): 1–10 scales as two rows of five buttons. Sleep: fell asleep,
   woke up, actual sleep (suggested from the two times, crossing midnight, but editable), cycles,
   quality, device sleep score; "Add sleep stages" (collapsed) = Deep / REM / Light % with a
   stacked bar, Light auto-fills as 100 − Deep − REM, gentle warning if the total isn't ~100.
   Open again to edit. **Journal**: past entries.
7. **Meditation timer**: full screen, ring, bell at start and end, Wake Lock, pause, end early;
   coming back after the end time → "Did you finish?" → stars on Yes.
8. **Stars**: balance, goals with progress rings, reward shop (add / edit / delete, redeem with
   confirmation), history.
9. **Statistics**:
   - Score cards (last 7 days, with change vs the 7 days before): sleep score (last night +
     7-day average), mood and energy (1–10, one decimal), task completion %, meditation streak,
     check-in streak. A "How the sleep score is calculated" line.
   - Sleep (Week / Month / 3 months): score per night (calculated vs device), duration per night
     with the target line, Deep / REM / Light stacked bars, fell-asleep and wake-up times,
     sleep vs next-day mood and energy (nights at/above vs below target).
   - Mood and energy (1–10), tasks per day, per category, streaks.
   - **Weekly review**: what went well, what slipped.
10. **More / Settings**: theme (System / Light / Dark), star values, meditation lengths,
    categories, reminders and quiet hours, PIN and auto-lock, Export, install, sign out, version.
11. **Export**: date range → JSON (starts with the analysis brief) + CSV. Includes every sleep
    field plus the calculated sleep score and its parts. The brief says ratings are 1–10 and asks
    to look at: sleep stages vs next-day mood and energy, fall-asleep consistency vs mood,
    cycles / duration vs productivity, calculated vs device sleep score, mood vs sleep,
    meditation vs mood, completion by weekday, streak breaks, trends, what to improve.

## Sleep score (0–100, `src/lib/sleepScore.js`, not medical advice)
| Part | Points | Full points when |
|---|---|---|
| Duration | 40 | actual sleep ≥ target (default 7 h 30 min); linear below |
| Stages | 30 | deep % and REM % inside the ranges (defaults 13–23 %, 20–25 %); 0 at 10 points outside |
| Regularity | 20 | fell asleep within ±30 min of the previous 7 nights' average; 0 at ±2 h |
| Quality | 10 | own rating: 1 → 0, 10 → full |

Missing parts are left out and their weight goes to the others. Nothing entered → no score.
Target and ranges are editable in Settings.

## Chart colors
Categories and multi-series charts use the validated 8-slot categorical palette (light and dark
steps, fixed order); single-series charts use the app's green accent. Light-mode slots 3, 4, 5
are below 3:1 on white, so category charts always show labeled values next to the colors.
Sleep stages use one green ramp (validated as an ordinal ramp in both modes), always with text
labels: Deep darkest, REM medium, Light lightest.

| | Light mode | Dark mode |
|---|---|---|
| Deep | `#0d4d2b` | `#1d7744` |
| REM | `#24894f` | `#3fb873` |
| Light | `#5fb985` | `#9fe3bb` |
