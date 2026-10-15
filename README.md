# Issue Reporter

Report and track faults with computers, projectors, fans, lights and Wi-Fi.
Node.js + Express + SQLite on the back end, React + Tailwind on the front end.
No Firebase and no database server: the database is one file.

## Run it on Windows (easiest)

1. Install **Node.js LTS** from https://nodejs.org (default options).
2. Extract the zip to a **new folder**, for example `C:\projects\issue-tracker`.
3. Double-click **`setup-and-run.bat`**. The first run installs everything (a few minutes), then opens the site.

Later runs: double-click the same file. It skips the installs.

> If you prefer the terminal and PowerShell blocks `npm`, use **Command Prompt (cmd)** instead,
> or run once: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

## Run it from a terminal (any system)

```bash
npm run setup     # installs everything and creates server/.env
npm run dev       # API on :4000, website on http://localhost:5173
```

Sign in with the admin account from `server/.env` (default `admin@example.com` / `ChangeMe123!`).
**Change that password before going live.**

Emails (verification, password reset, status updates) are printed in the server window until you configure SMTP.

## What's inside

**Reporters**: sign up / Google sign-in, report an issue with photos and an optional **voice note**,
"Me too" instead of duplicates, edit or withdraw while pending, follow a status timeline, chat with staff,
reopen and rate. Anonymous reporting. Notifications (bell, sound, browser alerts).

**Admins**: overview with charts, hotspots, technician performance and CSV/PDF export;
complaint table with search, filters, sorting, bulk actions; assign technicians; internal notes;
user and role management; categories; printable room QR codes.

**Technicians**: "My work" list of their assigned jobs, status updates, replies.

**Everyone**: Light / Dark / System theme, English and Urdu (right-to-left), installable as an app (PWA).

## Auto-assign

Open **Users**, give someone the *Technician* role, then tick the categories they handle.
New complaints in those categories go to the technician with the fewest open jobs, and they get an alert.
Three or more people affected raises low/medium priority to high automatically.

## Notifications and alerts

- Admins are notified of every new issue; reporters when their issue is picked up, resolved, or replied to.
- Click the bell, then **"Get alerts on this device"** to receive browser alerts, even when the tab is closed.
  This needs `http://localhost` or **https**. It will not work over a plain `http://192.168...` address.
- Sound can be muted from the bell menu.

## Turn on "Continue with Google"

The code is ready; you only need a free Google Client ID. Full click-by-click guide: **[GOOGLE_SETUP.md](GOOGLE_SETUP.md)**.

Short version: create an OAuth client ID (Web application) at https://console.cloud.google.com/apis/credentials,
add `http://localhost:5173` under **Authorized JavaScript origins**, then double-click `setup-google.bat`
(or run `npm run setup:google`) and paste the ID. Restart. Open the site at exactly `http://localhost:5173`.

Until then the Google button shows a clear "not set up yet" message and the server prints `Google sign-in: OFF`.

## Only allow your school's emails

In `server/.env`: `ALLOWED_EMAIL_DOMAINS=myschool.edu.pk` (comma-separate several). Applies to sign-up and Google sign-in.

## Room QR codes

Admin -> **Room QR codes**. Set the website address to something phones can reach
(your deployed address, or your computer's network address while testing), add rooms, print.

## Going live

```bash
npm run build                          # builds the website into client/dist
NODE_ENV=production npm start          # one server serves API + website
```

Set a strong `JWT_SECRET` (the server refuses to start in production without one), set `CLIENT_URL`
to your real address, use **https**, and back up `server/data/issues.db` and `server/uploads/`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `better-sqlite3` / `node-gyp` error | Install Node.js **LTS** (20 or 22+). Delete `server\node_modules` and run again. |
| `EADDRINUSE` / port in use | Change `PORT=4001` in `server/.env`, and the proxy port in `client/vite.config.js`. |
| Google button says "not set up yet" | Add `GOOGLE_CLIENT_ID` (run `setup-google.bat`). |
| Google popup says `origin_mismatch` | Use exactly `http://localhost:5173` and add it to Authorized JavaScript origins. See GOOGLE_SETUP.md. |
| No voice recording | Allow the microphone in the browser; needs `localhost` or https. |
| Urdu text looks small | It is a different font; use browser zoom (Ctrl +). |

## Security notes

bcrypt password hashing; httpOnly cookie sessions; rate-limited auth routes; zod validation;
uploads checked by type, size and real file contents and renamed randomly; role checks on every admin route;
anonymous reporters are hidden from staff by the server; CSV export neutralises formula injection.

## Not included yet

Messages from the server (such as notification text) are in English even when the app is in Urdu.
