# Alex's Organizer

Private, single-user life organizer (PWA) for Google Pixel 8 (Chrome) and desktop Chrome:
tasks, morning / evening check-ins, meditation timer, stars & rewards, statistics, export, reminders.

- Live: https://alexs-organizer.web.app
- Setup checklist: [docs/SETUP.md](docs/SETUP.md)
- Plan, data structure and screens: [docs/PLAN.md](docs/PLAN.md)

Stack: Vite + React + Tailwind, Firebase (Google login, Firestore, Cloud Functions, Cloud Messaging,
Hosting) in `europe-central2`. All database reads and writes live in `src/services/`.
