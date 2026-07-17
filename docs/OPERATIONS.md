# Guía de operaciones — RailBoard

> **Idioma:** Español
> **Última actualización:** 2026-07-17
> **Stack:** Docker Compose (2 servicios: backend + frontend), SQLite, Nginx

---

## Índice

- [Arquitectura operativa](#arquitectura-operativa)
- [Detección de incidentes](#detección-de-incidentes)
- [Diagnóstico](#diagnóstico)
- [Recuperación](#recuperación)
- [Copias de seguridad](#copias-de-seguridad)
- [Monitorización propuesta](#monitorización-propuesta)
- [Alertas propuestas](#alertas-propuestas)
- [Runbooks](#runbooks)
- [Variables de entorno](#variables-de-entorno)

---

## Arquitectura operativa

```
                     ┌──────────────┐
                     │   Usuario    │
                     │  (navegador) │
                     └──────┬───────┘
                            │ :80
                     ┌──────▼───────┐
                     │   Frontend   │
                     │ (Nginx + SPA)│
                     │   :80        │
                     └──────┬───────┘
                            │ /api /ws
                     ┌──────▼───────┐
                     │   Backend    │
                     │  (Express)   │
                     │   :4000      │
                     └──────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         ┌────▼────┐  ┌────▼────┐  ┌────▼────┐
         │ data.db │  │ uploads │  │  Logs   │
         │ (SQLite)│  │ (fs)    │  │(stdout) │
         └─────────┘  └─────────┘  └─────────┘
```

- **Health check:** `GET /health` → `{ "ok": true }`
- **Logs:** `console.log` sin estructura (hay que mejorar)
- **Monitorización:** Ninguna
- **Métricas:** Ninguna
- **Alertas:** Ninguna
- **Pipeline de despliegue:** Ninguno

---

## Detección de incidentes

### 1. Servicio caído

```bash
# Comprobar estado de los contenedores
docker compose ps

# Comprobar health check
curl -f http://localhost/health
curl -f http://localhost:4000/health

# Si el contenedor no está healthy
docker compose logs --tail=50 backend
```

### 2. Base de datos corrupta

```bash
# Buscar errores de SQLite
docker compose logs backend | grep -i "sqlite_error\|sqlite_busy"
```

Síntomas: endpoints retornan 500, trenes no se cargan, el admin no puede guardar cambios.

### 3. Disco de subidas lleno

```bash
docker compose exec backend df -h /app/uploads
docker compose exec backend du -sh /app/uploads
docker compose exec backend df -h /app/data
```

Síntomas: subidas fallan, base de datos no puede escribir.

### 4. Frontend no carga

```bash
# Comprobar logs de Nginx
docker compose logs frontend

# Verificar que los archivos de build existen
docker compose exec frontend ls -la /usr/share/nginx/html

# Probar conexión directa al backend
docker compose exec frontend wget -qO- http://backend:4000/health
```

---

## Diagnóstico

### Logs

```bash
# Backend en tiempo real
docker compose logs -f --tail=100 backend

# Frontend (Nginx) en tiempo real
docker compose logs -f --tail=100 frontend

# Últimos N errores
docker compose logs --tail=200 backend
```

### Comprobaciones en caliente

```bash
# Número de trenes en la base de datos
docker compose exec backend node -e "console.log(require('./src/db.js').listTrains().length)"

# Estado de la base de datos
docker compose exec backend node -e "const db=require('./src/db.js'); console.log({trains: db.listTrains().length, operators: db.listOperators().length, places: db.listPlaces().length})"

# Ver configuración actual
docker compose exec backend node -e "console.log(require('./src/db.js').getConfig())"

# Comprobar conexión WebSocket
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost/ws');
ws.on('open', () => { console.log('WS connected'); ws.close(); });
ws.on('error', (e) => console.error('WS error:', e.message));
"
```

### Inspección de red

```bash
# Comprobar que Nginx proxy funciona
curl -sv http://localhost/api/trains 2>&1 | grep -E "HTTP/|content-type"

# Comprobar headers de seguridad
curl -sI http://localhost/health | grep -E "X-Content-Type-Options|X-Frame-Options|Content-Security-Policy"
```

---

## Recuperación

### Reiniciar contenedores

```bash
# Reiniciar solo backend (conserva datos)
docker compose restart backend

# Reiniciar todo (conserva datos)
docker compose restart

# Detener y arrancar de nuevo
docker compose down && docker compose up -d
```

### Restaurar base de datos desde copia

```bash
# 1. Identificar la copia más reciente
docker compose exec backend ls -lt /app/data/backup-*.db

# 2. Detener backend
docker compose stop backend

# 3. Restaurar
docker compose exec backend sh -c "cp /app/data/backup-20260717-120000.db /app/data/data.db"

# 4. Arrancar backend
docker compose start backend
```

### Reset completo (DESTRUCTIVO)

```bash
# Elimina TODOS los datos (DB + uploads)
docker compose down -v
docker compose up --build
```

> ⚠️ Esta operación borra el volumen `db-data` y `uploads`. No se puede deshacer.

### Reseed de datos de demostración

```bash
docker compose exec backend node src/seed.js
```

> ⚠️ `seed.js` borra TODOS los datos existentes antes de crear otros nuevos.

---

## Copias de seguridad

### Manual

```bash
docker compose exec backend sh -c "cp /app/data/data.db /app/data/backup-$(date +%Y%m%d-%H%M%S).db"
```

### Automatización propuesta

Opción A — Script en el host via cron:

```bash
# /etc/cron.hourly/railboard-backup
#!/bin/bash
docker exec railboard-backend sh -c "cp /app/data/data.db /app/data/backup-\$(date +\%Y\%m\%d-\%H\%M\%S).db"

# Mantener solo los últimos 30 backups
docker exec railboard-backend sh -c "ls -t /app/data/backup-*.db | tail -n +31 | xargs rm -f"
```

Opción B — Contenedor sidecar (propuesto para el futuro):

```yaml
services:
  backup:
    image: alpine
    volumes:
      - db-data:/data:ro
      - ./backups:/backups
    entrypoint: |
      sh -c "while true; do
        cp /data/data.db /backups/backup-$(date +%Y%m%d-%H%M%S).db;
        sleep 3600;
      done"
```

---

## Monitorización propuesta

### Health check mejorado

Ampliar `GET /health` para incluir:

```javascript
{
  ok: true,
  db: { connected: true, trainCount: 42 },
  disk: { uploads: "120MB free", data: "800MB free" },
  uptime: 3600
}
```

### Docker healthcheck

Ya configurado en `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:4000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

### Middleware de errores (propuesto)

Añadir un catch-all error middleware que loguee JSON estructurado:

```javascript
app.use((err, req, res, next) => {
  console.log(JSON.stringify({
    level: "error",
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: err.status || 500,
    message: err.message,
    stack: process.env.NODE_ENV !== "production" ? err.stack : undefined
  }));
  res.status(err.status || 500).json({ error: "Internal Server Error" });
});
```

### Métricas propuestas (futuro)

| Métrica | Fuente | Para |
|---------|--------|------|
| `trains.count` | DB | Saber cuánta capacidad se usa |
| `ws.connections` | ws.js | Usuarios conectados en tiempo real |
| `http.requests.total` | Middleware | Volumen de tráfico |
| `http.requests.errors` | Middleware | Tasa de error |
| `disk.uploads.free` | df | Espacio disponible para subidas |
| `disk.data.free` | df | Espacio disponible para DB |

---

## Alertas propuestas

| # | Condición | Acción |
|---|-----------|--------|
| 1 | Health check falla 3 veces consecutivas | Reiniciar backend, notificar |
| 2 | Error SQLite en los logs | Comprobar integridad DB, restaurar backup |
| 3 | Espacio en `/app/uploads` < 100 MB | Limpiar archivos antiguos, alertar |
| 4 | Espacio en `/app/data` < 100 MB | Comprimir backups antiguos, alertar |

---

## Runbooks

### 1. Servicio inaccesible

```bash
# 1. Comprobar estado
docker compose ps

# 2. Mirar logs
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend

# 3. Comprobar puertos
ss -tlnp | grep -E ":80|:4000"

# 4. Reiniciar
docker compose restart

# 5. Si no funciona, reconstruir
docker compose down && docker compose up --build -d
```

### 2. Base de datos corrupta

```bash
# 1. Identificar backups disponibles
docker compose exec backend ls -lt /app/data/backup-*.db

# 2. Detener backend
docker compose stop backend

# 3. Restaurar el backup más reciente
docker compose exec backend sh -c "cp /app/data/backup-$(ls /app/data/backup-*.db | tail -1 | xargs basename) /app/data/data.db"

# 4. Arrancar
docker compose start backend

# 5. Verificar
curl -s http://localhost/api/trains | head -c 100

# 6. Si no hay backup, hacer reseed
docker compose exec backend node src/seed.js
```

### 3. Disco de subidas lleno

```bash
# 1. Ver ocupación
docker compose exec backend du -sh /app/uploads/* | sort -rh

# 2. Eliminar archivos antiguos (>30 días)
docker compose exec backend find /app/uploads -type f -mtime +30 -delete

# 3. Verificar espacio liberado
docker compose exec backend df -h /app/uploads
```

### 4. Frontend muestra página en blanco

```bash
# 1. Comprobar logs de Nginx
docker compose logs frontend

# 2. Verificar build
docker compose exec frontend ls -la /usr/share/nginx/html

# 3. Comprobar que el backend es accesible desde el frontend
docker compose exec frontend wget -qO- http://backend:4000/health

# 4. Reconstruir frontend
docker compose up --build -d frontend

# 5. Comprobar configuración Nginx
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### 5. WebSocket no conecta

```bash
# 1. Comprobar que el backend está healthy
curl -s http://localhost/health

# 2. Verificar configuración Nginx para /ws
docker compose exec frontend cat /etc/nginx/conf.d/default.conf | grep -A 10 "/ws"

# 3. Probar conexión WebSocket directa
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost/ws');
ws.on('open', () => { console.log('OK'); ws.close(); });
ws.on('error', (e) => console.error('ERROR:', e.message));
"

# 4. Comprobar logs del backend para errores WS
docker compose logs backend | grep -i "websocket\|ws"
```

---

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|----------|-------------------|-------------|
| `PORT` | `4000` | Puerto del backend (docker) |
| `DB_PATH` | `/app/data/data.db` | Ruta absoluta a la base de datos SQLite |
| `CORS_ORIGIN` | `http://localhost` | Origen permitido para CORS |
| `ADMIN_PASSWORD` | `railboard` | Contraseña de admin (⚠️ cambiar en producción) |
| `NODE_ENV` | (vacío) | `production` activa optimizaciones |
| `RATE_LIMIT_MAX` | `120` | Máximo de peticiones por minuto |
| `VITE_API_URL` | (vacío) | URL de la API para el frontend |
| `HOST_PORT` | `80` | Puerto publicado del contenedor frontend |
