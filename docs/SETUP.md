# Setup: what is still yours to do (one sitting, ≈ 20 minutes)

Already done by you: project **alexs-organizer**, Blaze plan, Google sign-in, Firestore in
`europe-central2`. Already done in the code: web config, security rules (only
`elephantgigant@gmail.com`), the auto-publish workflow.

Do the parts in this order. Each line is one action.

---

## A. Turn on Hosting (1 minute)
1. Open https://console.firebase.google.com/project/alexs-organizer/hosting
2. Click **Get started**.
3. Click **Next**, **Next**, then **Continue to console** (don't install anything).

## B. Publishing key → GitHub (5 minutes)
**Download the key**
1. Open https://console.firebase.google.com/project/alexs-organizer/settings/serviceaccounts/adminsdk
2. Click **Generate new private key**.
3. Click **Generate key**. A `.json` file downloads.
   🔒 It's a password: never paste it in chat or email.

**Give the key its roles**
4. Open https://console.cloud.google.com/iam-admin/iam?project=alexs-organizer
5. Find the row whose email starts with **`firebase-adminsdk-`**.
6. Click the ✏️ pencil on that row.
7. Click **+ Add another role** → type **Firebase Admin** → select it.
8. Click **+ Add another role** → type **Service Usage Consumer** → select it.
9. Click **+ Add another role** → type **Editor** → select **Editor** (Basic).
10. Click **Save**.

**Put the key into GitHub**
11. Open https://github.com/elephantgigant-dotcom/alexs-organizer/settings/secrets/actions
12. Click **New repository secret**.
13. Name: `FIREBASE_SERVICE_ACCOUNT`
14. Secret: open the `.json` file in Notepad / TextEdit → select all → copy → paste here.
15. Click **Add secret**.
16. Delete the `.json` file from your computer.

## C. Google login on the app's own address (2 minutes)
1. Open https://console.cloud.google.com/apis/credentials?project=alexs-organizer
2. Under **OAuth 2.0 Client IDs**, click **Web client (auto created by Google Service)**.
3. **Authorized JavaScript origins** → **+ Add URI** → `https://alexs-organizer.web.app`
4. **+ Add URI** → `https://alexs-organizer.firebaseapp.com`
5. **Authorized redirect URIs** → **+ Add URI** → `https://alexs-organizer.web.app/__/auth/handler`
6. **+ Add URI** → `https://alexs-organizer.firebaseapp.com/__/auth/handler`
7. Click **Save**. (It can take 5–10 minutes to start working.)

## D. Web Push key (1 minute)
1. Open https://console.firebase.google.com/project/alexs-organizer/settings/cloudmessaging
2. Scroll to **Web Push certificates**.
3. Click **Generate key pair**.
4. Copy the long key and send it to me in chat. (Not a secret, it goes into the app.)

## E. Budget alert (optional, recommended, 2 minutes)
1. Open https://console.cloud.google.com/billing/budgets
2. Click **Create budget** → Name `Organizer` → Projects: `alexs-organizer` → **Next**.
3. Amount: **5** (PLN) per month → **Next** → keep the 50 / 90 / 100 % alerts → **Finish**.

When done, write **"checklist done"** plus the Web Push key.

---

## How publishing works
Every push to GitHub runs **Test & publish** (Actions tab): tests → build → website + rules →
Cloud Functions. When it's green, the app at **https://alexs-organizer.web.app** is updated.
On the phone: fully close the app (swipe it away from recent apps) and open it again.

If the very first Cloud Functions publish fails with a permissions / Eventarc message,
that's Google still switching services on. Re-run it once: Actions → the failed run →
**Re-run all jobs**.

## About the PIN lock (honest version)
The PIN is a **screen lock**, not encryption. It stops someone who picks up your unlocked phone.
Your data is really protected by your Google login plus the Firestore rules, which refuse every
other account. Forgot the PIN? Choose **Forgot PIN** → sign in with Google again → set a new one.

## For the curious: running it on a computer
Install **Node.js 22** from https://nodejs.org, then in this folder:
```bash
npm install
npm run dev          # http://localhost:5173 (uses the real Firebase)
npm test             # date / repeat / stars / reminder logic
npm run test:rules   # security rules (needs Java 21)
```
