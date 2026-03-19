# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start      # Production (node --experimental-sqlite server.js)
npm run dev    # Dev with auto-reload (nodemon)
```

The `--experimental-sqlite` flag is required because the app uses Node.js 24's built-in `node:sqlite` module (no native compilation needed). The server runs on `http://localhost:3000` by default.

## Default admin credentials

`admin@zotride.fr` / `admin123` (created automatically on first run if no admin exists).

## Architecture

**Full-stack Node.js SPA** — Express backend + vanilla JS frontend served as static files.

### Backend (`/`)
- `server.js` — Express entry point, mounts all routes, serves `public/` as static
- `database/db.js` — SQLite init via `node:sqlite`; creates tables and default admin on startup
- `middleware/auth.js` — JWT `authenticate` and `requireAdmin` middleware
- `routes/` — `auth.js`, `users.js`, `sorties.js`, `admin.js`, `notifications.js`

All API routes are under `/api/*`. The SPA fallback (`app.get('*')`) returns `public/index.html`.

### Frontend (`public/`)
- Single HTML file (`index.html`) with all page sections (`#page-login`, `#page-dashboard`, etc.) toggled via `d-none`
- `js/app.js` — global state (`currentUser`), navigation (`showPage()`), shared `api()` fetch wrapper, auth, notifications polling, profile
- `js/map.js` — Leaflet map logic: create-sortie map (click-to-add waypoints, polyline), detail map, geolocation marker
- `js/sorties.js` — sortie list, detail view, create/participate/delete
- `js/admin.js` — admin panel: stats, user validation/deletion, sortie management

### Data model
- `users`: pseudo, email, password (bcrypt), moto_marque, moto_cylindree, role (`user`|`admin`), validated (0/1)
- `sorties`: titre, description, date, heure, nb_max_participants, created_by (FK users), status
- `waypoints`: sortie_id (FK), lat, lng, nom, ordre, is_rassemblement (first point = rally point)
- `participants`: sortie_id + user_id (unique pair)
- `notifications`: user_id, message, type, read

### Key flows
- **Registration** → admin notified → admin validates → user notified → user can log in
- **Create sortie** → all validated members notified
- **Join sortie** → organiser notified; capacity check enforced server-side
- **Map** (Leaflet): center = Réunion Island `[-21.1151, 55.5364]`, zoom 11. Click adds waypoints; first = rally point (red), others = étapes (orange). Polyline connects all points.
- **Notifications**: polled every 30s via `pollNotifications()`; read on bell click

### Environment
`.env` variables: `PORT` (default 3000), `JWT_SECRET`. JWT expires in 7 days.
