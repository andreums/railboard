# Railboard

Aplicación web para paneles informativos de estaciones de tren, con display público en tiempo real y panel de administración.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + SQLite (better-sqlite3) + WebSocket
- **Comunicación:** REST API + WebSocket para actualizaciones en tiempo real

## Estructura del proyecto

```
railboard/
├── frontend/               # Aplicación React SPA
│   ├── src/
│   │   ├── components/     # Componentes (pis/, admin/, Clock, StatusPill…)
│   │   ├── pages/          # Páginas/rutas de la app
│   │   ├── hooks/          # Hooks personalizados
│   │   ├── lib/            # API client, i18n, tts, utilidades
│   │   ├── services/       # Clientes de servicios (rutas)
│   │   ├── types/          # Tipos TypeScript
│   │   └── styles/         # Estilos globales
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── backend/                # Servidor Express + SQLite
│   ├── src/
│   │   ├── index.js        # Entry point
│   │   ├── db.js           # Esquema y acceso a datos
│   │   ├── routes.js       # API administrativa (/admin)
│   │   ├── railRoutesApi.js# API pública (/api)
│   │   ├── ws.js           # Servidor WebSocket
│   │   ├── services/       # TTS, anuncios, simulación, automatización…
│   │   ├── migrations/     # Migraciones SQL
│   │   └── seed.js         # Datos de demostración
│   └── migrations/         # Migraciones SQL (000-025)
└── docs/                   # Documentación
```

## Páginas

| Ruta              | Componente      | Descripción                         |
| ----------------- | --------------- | ----------------------------------- |
| `/`               | `Display`       | Panel público de llegadas/salidas   |
| `/s/:displayId`   | `DisplayPage`   | Pantalla individual de un display   |
| `/admin`          | `Admin`         | Dashboard de administración         |
| `/operator`       | `Operator`      | Vista de operador                   |
| `/trains`         | `Trains`        | Gestión de trenes con drag & drop   |
| `/train-settings` | `TrainSettings` | Operadores y tipos de tren          |

## Documentación

- [API](api.md) — endpoints REST + WebSocket
- [Arquitectura](architecture.md) — decisiones y diagramas
- [Backend](backend.md) — servidor, BD, migraciones, TTS
- [Frontend](frontend.md) — componentes, rutas, API client
- [Progreso](PROGRESS.md) — estado del proyecto
- [Análisis](ANALYSIS.md) / [Dominio](DOMAIN-MODEL.md) / [Deuda técnica](TECHNICAL-DEBT.md) / [Seguridad](SECURITY-REVIEW.md)
