# Plan: data structure and screens

## Rules
- Single user. Everything lives under `users/{uid}/…`; `firestore.rules` lets in only
  `elephantgigant@gmail.com` (verified) and only its own `uid`.
- Calendar dates are **date keys** `YYYY-MM-DD` in **Europe/Warsaw** (`src/lib/dates.js`);
  times are `HH:MM`. Weeks start on **Monday**; a week's id is its Monday's key.
- All database reads and writes live in `src/services/` only.
- Stars are paid through **star events with fixed ids** (`task_<id>`, `checkin_<date>_<type>`,
  `meditation_<id>`, `streak_<kind>_<date>`), written in the same batch as the balance change,
  so nothing can pay twice (double tap, offline replay, two devices).

## Firestore
```
users/{uid}                     profile + settings
  email, balance (stars), createdAt
  settings: {
    theme: 'system' | 'light' | 'dark',
    stars: { meditation: 5, checkin: 2, streakBonus: 10, streakEvery: 7 },
    meditation: { morningMin: 10, eveningMin: 10 },          // 5–30
    pin: { hash, salt, iterations, autoLockMin: 5 } | null,  // PBKDF2 (Web Crypto)
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
  type 'morning': mood 1–5, energy 1–5, sleep { hours, quality 1–5, bedtime, wakeTime },
                  intentions [3 strings], note
  type 'evening': mood 1–5, energy 1–5, dayRating 1–5, wentWell, improve, gratitude, note
  + date, createdAt, updatedAt

users/{uid}/meditations/{id}    slot 'morning'|'evening', date, plannedMin, startedAt,
                                endsAt (timestamp-based timer), pausedAt?, pausedMs,
                                status 'running'|'done'|'cancelled', completedAt, stars

users/{uid}/starEvents/{id}     amount (+/−), type 'task'|'checkin'|'meditation'|'streak'|'redeem'|'undo',
                                refId, note, date, createdAt

users/{uid}/rewards/{id}        title, emoji, price          default: "Play a video game I want" = 500
users/{uid}/goals/{id}          title, target (stars earned), period 'week'|'month'|'custom',
                                from?, to?  (progress = stars earned in that period)

users/{uid}/devices/{id}        push token per device (Pixel, desktop)
users/{uid}/pushTests/{id}      "send me a test notification"
users/{uid}/weeklySummaries/{weekMonday}   written by the server only (weekly backup)
```

## Screens (bottom menu: Today · Week · Stars · Stats · More)
1. **Login**: Google only. Another account → "This app is private".
2. **PIN**: set up (4–6 digits), unlock screen, Forgot PIN → Google sign-in again.
3. **Today**: date, star balance, morning check-in + meditation cards (evening ones after 17:00),
   today's tasks with progress, overdue tasks, + button.
4. **Task sheet** (bottom sheet): title, notes, category, date, time, priority, stars 1–5, repeat.
5. **Week**: Monday–Sunday strip with task counts, tasks grouped per day, previous / next week.
6. **Check-in** (morning / evening): form above; open again to edit. **Journal**: past entries.
7. **Meditation timer**: full screen, ring, bell at start and end, Wake Lock, pause, end early;
   coming back after the end time → "Did you finish?" → stars on Yes.
8. **Stars**: balance, goals with progress rings, reward shop (add / edit / delete, redeem with
   confirmation), history.
9. **Statistics**: week / month / year; completion rate, tasks per day, per category,
   streaks, mood / energy / sleep charts. **Weekly review**: what went well, what slipped.
10. **More / Settings**: theme (System / Light / Dark), star values, meditation lengths,
    categories, reminders and quiet hours, PIN and auto-lock, Export, install, sign out, version.
11. **Export**: date range → JSON (starts with the analysis brief) + CSV.

## Chart colors
Categories and multi-series charts use the validated 8-slot categorical palette (light and dark
steps, fixed order); single-series charts use the app's green accent. Light-mode slots 3, 4, 5
are below 3:1 on white, so category charts always show labeled values next to the colors.
