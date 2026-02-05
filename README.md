# Pinterest API – minimal web app

Bare-bones web app that uses the Pinterest API to **authenticate**, **view** your pins, and **create** pins. Minimal UI, single page.

## Setup

1. **Pinterest app**
   - Go to [developers.pinterest.com/apps](https://developers.pinterest.com/apps/) and create an app (or use an existing one).
   - In the app settings, set the **Redirect URI** to `http://localhost:3000/callback` (or your chosen URL).
   - Note your **App ID** and **App secret**.

2. **Env**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `PINTEREST_APP_ID` – your app ID  
   - `PINTEREST_APP_SECRET` – your app secret  
   - `REDIRECT_URI` – must match the redirect URI in the Pinterest app (e.g. `http://localhost:3000/callback`)

3. **Install and run**
   ```bash
   npm install
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Usage

- **Log in** – “Log in with Pinterest” starts OAuth and stores a session.
- **View pins** – After login, your recent pins are shown.
- **Create pin** – Pick a board, set image URL (required), optional title/description/link, then “Create pin”.

## Project layout

- `server.js` – Express server: OAuth (login, callback, logout) and API proxy so the client never sees the app secret.
- `public/` – Static frontend: `index.html`, `style.css`, `app.js`.

Credentials and tokens stay on the server; the browser only talks to your app.
