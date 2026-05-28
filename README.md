# RailBoard — Model Railway Departure Board

A local-first web app that simulates a modern Spanish-style railway station
departure board (think Renfe / Adif) for model railway events. It ships with
a Node.js + Express + SQLite backend, real-time WebSocket updates, a
fullscreen public display, and an admin panel — both built with React, Vite
and Tailwind CSS.

## Features

- Fullscreen public board (dark navy, large white type, alternating rows,
  train type badges, operator logos, large platform / sector numbers).
- Departures **and** arrivals modes (switchable from admin).
- Live clock, "minutes remaining" countdown, intermediate stops marquee.
- Admin panel to CRUD trains, change status (Scheduled / Boarding / Delayed
  / Departed / Arrived / Cancelled), apply delays, change platform, manage
  destinations, upload operator & train-type logos, and trigger station
  announcements via the browser Web Speech API.
- Real-time sync: every change broadcasts over WebSockets so the display
  updates instantly without polling.
- SQLite persistence — single `data.db` file, zero setup.
- Seed data with fictional Spanish-style trains (AVE, Avlo, Alvia,
  Intercity, Media Distancia, Cercanías).

## Architecture

```
railboard/
├── backend/         Express + better-sqlite3 + ws
│   ├── src/
│   │   ├── index.js       HTTP + WS server
│   │   ├── db.js          SQLite schema + helpers
│   │   ├── routes.js      REST API
│   │   ├── ws.js          WebSocket broadcaster
│   │   └── seed.js        Seed fictional trains
│   ├── uploads/           Uploaded logos (served at /uploads)
│   └── data.db            Created on first run
└── frontend/        React + Vite + TS + Tailwind
    ├── src/
    │   ├── pages/Display.tsx   Fullscreen public board
    │   ├── pages/Admin.tsx     Admin panel
    │   ├── components/...
    │   └── lib/api.ts          REST + WS client
    └── ...
```

The architecture is intentionally simple so later features are easy to add:

- **CSV import/export** → drop endpoints in `backend/src/routes.js`.
- **Automatic clock-based progression** → add a `setInterval` tick in
  `backend/src/index.js` that promotes statuses based on `expected_time`.
- **Multiple station profiles** → add a `stations` table and a
  `station_id` FK on `trains`; the `config` table already isolates the
  active station.
- **PWA mode** → add `vite-plugin-pwa` to `frontend/vite.config.ts`.

## Local setup

Requires Node.js ≥ 18.

### 1. Backend

```bash
cd backend
npm install
npm run seed     # optional — creates data.db with fictional trains
npm run dev      # http://localhost:4000
```

REST API lives at `http://localhost:4000/api/...`, WebSocket at
`ws://localhost:4000/ws`, uploaded logos at `http://localhost:4000/uploads/...`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Open:

- **Public display** — http://localhost:5173/  (press F11 for fullscreen)
- **Admin panel**   — http://localhost:5173/admin

The frontend talks to the backend via `VITE_API_URL` (defaults to
`http://localhost:4000`). Set it in `frontend/.env` if you change the port.

## REST API (summary)

| Method | Path                       | Purpose                       |
| ------ | -------------------------- | ----------------------------- |
| GET    | /api/config                | Get station config            |
| PUT    | /api/config                | Update station config         |
| GET    | /api/trains                | List trains                   |
| POST   | /api/trains                | Create train                  |
| PUT    | /api/trains/:id            | Update train                  |
| PATCH  | /api/trains/:id/status     | Change status                 |
| PATCH  | /api/trains/:id/delay      | Add delay (minutes)           |
| PATCH  | /api/trains/:id/platform   | Change platform / sector      |
| DELETE | /api/trains/:id            | Delete train                  |
| GET    | /api/operators             | List operators                |
| POST   | /api/operators             | Create operator (multipart)   |
| DELETE | /api/operators/:id         | Delete operator               |
| GET    | /api/train-types           | List train types              |
| POST   | /api/train-types           | Create train type (multipart) |
| DELETE | /api/train-types/:id       | Delete train type             |
| GET    | /api/places                | List places                   |
| POST   | /api/places                | Create place                  |
| DELETE | /api/places/:id            | Delete place                  |

All mutations broadcast `{ type: "update" }` over the WebSocket so the
public display refreshes immediately.

## License

MIT — have fun at your event.
# railboard
A small hobby web app for managing railway station display boards in model railway setups.
