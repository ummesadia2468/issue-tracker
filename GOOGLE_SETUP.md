# Turn on "Continue with Google" (5 minutes, free)

The code is already done. The only missing piece is a **Google Client ID**, which only you can create
(it is tied to your Google account). Follow these steps once.

## Step 1: Create the Client ID

1. Open https://console.cloud.google.com and sign in with your Google account.
2. Top bar -> project drop-down -> **New project** -> name it `Issue Reporter` -> **Create**. Select it.
3. Left menu -> **APIs & Services** -> **OAuth consent screen** (may be called **Google Auth Platform**).
   - Click **Get started** / **Configure**.
   - App name: `Issue Reporter`. User support email: your email.
   - Audience: **External**. Contact email: your email. Accept the terms -> **Create**.
4. Left menu -> **Credentials** (or **Clients**) -> **Create credentials** -> **OAuth client ID**.
   - Application type: **Web application**. Name: `Issue Reporter web`.
   - **Authorized JavaScript origins** -> **Add URI** -> `http://localhost:5173`
   - Leave **Authorized redirect URIs** EMPTY (this app does not use redirects).
   - **Create**.
5. Copy the **Client ID**. It looks like `123456789012-abcdefg.apps.googleusercontent.com`.
   You do NOT need the Client secret.

## Step 2: Give it to the app

Easiest: double-click **`setup-google.bat`** and paste the Client ID. It checks the format and saves it.

Or by hand: open `server/.env` and set

```
GOOGLE_CLIENT_ID=123456789012-abcdefg.apps.googleusercontent.com
```

## Step 3: Restart

Close the app window, run **`setup-and-run.bat`** again. The server prints
`Google sign-in: ON`. Open **http://localhost:5173** and the real Google button appears.

## While your app is in "Testing" mode

Google only lets **Test users** sign in. Go to **OAuth consent screen -> Audience -> Test users -> Add users**
and add every Gmail address you want to try (up to 100). To let anyone sign in, press **Publish app**
(for basic sign-in with name/email/photo no Google review is needed).

## Going live later

Add your real https address as another **Authorized JavaScript origin** (e.g. `https://issues.myschool.edu.pk`),
set `CLIENT_URL` to that address in `server/.env`, and rebuild. Google requires **https** for non-localhost origins.

## If something goes wrong

| What you see | Fix |
|---|---|
| Button says "not set up yet" | `GOOGLE_CLIENT_ID` is empty in `server/.env`, or you did not restart. |
| Google popup: `Error 400: origin_mismatch` / "The given origin is not allowed" | Open the site at exactly `http://localhost:5173` (not `127.0.0.1`, not `192.168.x.x`), and make sure that exact origin is in Authorized JavaScript origins. Changes can take a few minutes to apply. |
| `Error 403: access_denied` / "app not verified" | App is in Testing mode: add your Gmail under **Test users**, or Publish the app. |
| Port 5173 error when starting | Another program uses 5173. Close it. (The app refuses to jump to 5174 because Google would reject that origin.) |
| "Google sign-in failed" after choosing an account | Look at the server window: it prints `[google] token check failed: ...` with the real reason (usually a wrong/old Client ID in `server/.env`, or the PC clock is wrong). |
| "Only @school.edu emails can sign in" | `ALLOWED_EMAIL_DOMAINS` in `server/.env` is set. Add the domain or empty it. |
| Works on PC but not on phone via `http://192.168...` | Google does not allow IP addresses as origins. Test on the PC, or deploy on https with a real domain. |
