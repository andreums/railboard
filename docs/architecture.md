# Arquitectura

## Visión General

Railboard sigue una arquitectura cliente-servidor con comunicación REST + WebSocket. El frontend es una SPA React que se conecta al backend Express para operaciones CRUD y recibe actualizaciones en tiempo real vía WebSocket.

```
┌─────────────────────┐         ┌──────────────────────────┐
│     Frontend         │  HTTP   │       Backend            │
│   (React + Vite)     │◄───────►│   (Express + SQLite)     │
│                      │   WS    │                          │
│  Display.tsx         │◄───────►│  routes.js               │
│  Admin.tsx           │         │  ws.js                   │
│  Trains.tsx          │         │  db.js                   │
│  TrainSettings.tsx   │         │  data.db                 │
└─────────────────────┘         └──────────────────────────┘
```

## Flujo de datos

1. **Lectura:** Cada página carga sus datos vía `GET` al iniciar. `Display.tsx` además hace polling cada 5s como fallback.
2. **Escritura:** Las operaciones CRUD usan `POST/PUT/PATCH/DELETE`. El backend persiste en SQLite y luego emite `broadcast({ type: "update" })` vía WebSocket.
3. **Tiempo real:** Todos los clientes conectados al WebSocket reciben la señal de actualización y refrescan su estado.

## Stack técnico

| Capa      | Tecnología                          |
|-----------|-------------------------------------|
| Frontend  | React 18, TypeScript 5, Vite 5      |
| Estilos   | Tailwind CSS 3                      |
| Ruteo     | react-router-dom 6                  |
| Drag & drop | @dnd-kit                         |
| Backend   | Node.js, Express 4                  |
| BD        | SQLite (better-sqlite3)             |
| WS        | ws 8                                |
| Uploads   | multer                              |

## Seguridad

No hay autenticación ni autorización. El panel de administración es accesible por cualquiera que conozca la URL.
