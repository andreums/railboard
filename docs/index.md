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
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/          # Páginas/rutas de la app
│   │   ├── lib/            # API client, i18n
│   │   └── styles/         # Estilos globales
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── backend/                # Servidor Express + SQLite
│   └── src/
│       ├── index.js        # Entry point
│       ├── db.js           # Esquema y acceso a datos
│       ├── routes.js       # Rutas y lógica de negocio
│       ├── ws.js           # Servidor WebSocket
│       └── seed.js         # Datos de demostración
└── docs/                   # Documentación
```

## Páginas

| Ruta              | Componente      | Descripción                         |
| ----------------- | --------------- | ----------------------------------- |
| `/`               | `Display`       | Panel público de llegadas/salidas   |
| `/admin`          | `Admin`         | Configuración de estación y lugares |
| `/trains`         | `Trains`        | Gestión de trenes con drag & drop   |
| `/train-settings` | `TrainSettings` | Operadores y tipos de tren          |
