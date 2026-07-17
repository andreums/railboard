# Guia d'operacions — RailBoard

> **Idioma:** Català
> **Última actualització:** 2026-07-17
> **Stack:** Docker Compose (2 serveis: backend + frontend), SQLite, Nginx

---

## Índex

- [Arquitectura operativa](#arquitectura-operativa)
- [Detecció d'incidents](#detecció-dincidents)
- [Diagnòstic](#diagnòstic)
- [Recuperació](#recuperació)
- [Còpies de seguretat](#còpies-de-seguretat)
- [Monitoratge proposat](#monitoratge-proposat)
- [Alertes proposades](#alertes-proposades)
- [Runbooks](#runbooks)
- [Variables d'entorn](#variables-dentorn)

---

## Arquitectura operativa

```
                     ┌──────────────┐
                     │   Usuari     │
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
- **Logs:** `console.log` sense estructura (cal millorar)
- **Monitoratge:** Cap
- **Mètriques:** Cap
- **Alertes:** Cap
- **Pipeline de desplegament:** Cap

---

## Detecció d'incidents

### 1. Servei caigut

```bash
# Comprovar estat dels contenidors
docker compose ps

# Comprovar health check
curl -f http://localhost/health
curl -f http://localhost:4000/health

# Si el contenidor no està healthy
docker compose logs --tail=50 backend
```

### 2. Base de dades corrupta

```bash
# Buscar errors de SQLite
docker compose logs backend | grep -i "sqlite_error\|sqlite_busy"
```

Símptomes: endpoints retornen 500, trens no es carreguen, l'admin no pot desar canvis.

### 3. Disc de pujades ple

```bash
docker compose exec backend df -h /app/uploads
docker compose exec backend du -sh /app/uploads
docker compose exec backend df -h /app/data
```

Símptomes: pujades fallen, base de dades no pot escriure.

### 4. Frontend no carrega

```bash
# Comprovar logs de Nginx
docker compose logs frontend

# Verificar que els fitxers de build existeixen
docker compose exec frontend ls -la /usr/share/nginx/html

# Provar connexió directa al backend
docker compose exec frontend wget -qO- http://backend:4000/health
```

---

## Diagnòstic

### Logs

```bash
# Backend en temps real
docker compose logs -f --tail=100 backend

# Frontend (Nginx) en temps real
docker compose logs -f --tail=100 frontend

# Últims N errors
docker compose logs --tail=200 backend
```

### Comprovacions en calent

```bash
# Nombre de trens a la base de dades
docker compose exec backend node -e "console.log(require('./src/db.js').listTrains().length)"

# Estat de la base de dades
docker compose exec backend node -e "const db=require('./src/db.js'); console.log({trains: db.listTrains().length, operators: db.listOperators().length, places: db.listPlaces().length})"

# Veure config actual
docker compose exec backend node -e "console.log(require('./src/db.js').getConfig())"

# Comprovar connexió WebSocket
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost/ws');
ws.on('open', () => { console.log('WS connected'); ws.close(); });
ws.on('error', (e) => console.error('WS error:', e.message));
"
```

### Inspecció de xarxa

```bash
# Comprovar que Nginx proxy funciona
curl -sv http://localhost/api/trains 2>&1 | grep -E "HTTP/|content-type"

# Comprovar headers de seguretat
curl -sI http://localhost/health | grep -E "X-Content-Type-Options|X-Frame-Options|Content-Security-Policy"
```

---

## Recuperació

### Reiniciar contenidors

```bash
# Reiniciar només backend (conserva dades)
docker compose restart backend

# Reiniciar tot (conserva dades)
docker compose restart

# Aturar i engegar de nou
docker compose down && docker compose up -d
```

### Restaurar base de dades des de còpia

```bash
# 1. Identificar la còpia més recent
docker compose exec backend ls -lt /app/data/backup-*.db

# 2. Aturar backend
docker compose stop backend

# 3. Restaurar
docker compose exec backend sh -c "cp /app/data/backup-20260717-120000.db /app/data/data.db"

# 4. Engegar backend
docker compose start backend
```

### Reset complet (DESTRUCTIU)

```bash
# Elimina TOTES les dades (DB + uploads)
docker compose down -v
docker compose up --build
```

> ⚠️ Aquesta operació esborra el volum `db-data` i `uploads`. No es pot desfer.

### Reseed de dades de demostració

```bash
docker compose exec backend node src/seed.js
```

> ⚠️ `seed.js` esborra TOTES les dades existents abans de crear-ne de noves.

---

## Còpies de seguretat

### Manual

```bash
docker compose exec backend sh -c "cp /app/data/data.db /app/data/backup-$(date +%Y%m%d-%H%M%S).db"
```

### Automatització proposada

Opció A — Script al host via cron:

```bash
# /etc/cron.hourly/railboard-backup
#!/bin/bash
docker exec railboard-backend sh -c "cp /app/data/data.db /app/data/backup-\$(date +\%Y\%m\%d-\%H\%M\%S).db"

# Mantenir només els últims 30 backups
docker exec railboard-backend sh -c "ls -t /app/data/backup-*.db | tail -n +31 | xargs rm -f"
```

Opció B — Contenidor sidecar (proposat per al futur):

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

## Monitoratge proposat

### Health check millorat

Ampliar `GET /health` per incloure:

```javascript
{
  ok: true,
  db: { connected: true, trainCount: 42 },
  disk: { uploads: "120MB free", data: "800MB free" },
  uptime: 3600
}
```

### Docker healthcheck

Ja configurat a `docker-compose.yml`:

```yaml
healthcheck:
  test: ["CMD", "wget", "--spider", "-q", "http://localhost:4000/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

### Middleware d'errors (proposat)

Afegir un catch-all error middleware que loggegi JSON estructurat:

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

### Mètriques proposades (futur)

| Mètrica | Font | Per a |
|---------|------|-------|
| `trains.count` | DB | Saber quanta capacitat s'usa |
| `ws.connections` | ws.js | Usuaris connectats en temps real |
| `http.requests.total` | Middleware | Volum de tràfic |
| `http.requests.errors` | Middleware | Taxa d'error |
| `disk.uploads.free` | df | Espai disponible per a pujades |
| `disk.data.free` | df | Espai disponible per a DB |

---

## Alertes proposades

| # | Condició | Acció |
|---|----------|-------|
| 1 | Health check falla 3 vegades consecutives | Reiniciar backend, notificar |
| 2 | Error SQLite als logs | Comprovar integritat DB, restaurar backup |
| 3 | Espai a `/app/uploads` < 100 MB | Netejar fitxers antics, alertar |
| 4 | Espai a `/app/data` < 100 MB | Comprimir backups antics, alertar |

---

## Runbooks

### 1. Servei inaccessible

```bash
# 1. Comprovar estat
docker compose ps

# 2. Mirar logs
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend

# 3. Comprovar ports
ss -tlnp | grep -E ":80|:4000"

# 4. Reiniciar
docker compose restart

# 5. Si no funciona, reconstruir
docker compose down && docker compose up --build -d
```

### 2. Base de dades corrupta

```bash
# 1. Identificar backups disponibles
docker compose exec backend ls -lt /app/data/backup-*.db

# 2. Aturar backend
docker compose stop backend

# 3. Restaurar el backup més recent
docker compose exec backend sh -c "cp /app/data/backup-$(ls /app/data/backup-*.db | tail -1 | xargs basename) /app/data/data.db"

# 4. Engegar
docker compose start backend

# 5. Verificar
curl -s http://localhost/api/trains | head -c 100

# 6. Si no hi ha backup, fer reseed
docker compose exec backend node src/seed.js
```

### 3. Disc de pujades ple

```bash
# 1. Veure ocupació
docker compose exec backend du -sh /app/uploads/* | sort -rh

# 2. Eliminar fitxers antics (>30 dies)
docker compose exec backend find /app/uploads -type f -mtime +30 -delete

# 3. Verificar espai alliberat
docker compose exec backend df -h /app/uploads
```

### 4. Frontend mostra pàgina en blanc

```bash
# 1. Comprovar logs de Nginx
docker compose logs frontend

# 2. Verificar build
docker compose exec frontend ls -la /usr/share/nginx/html

# 3. Comprovar que el backend és accessible des del frontend
docker compose exec frontend wget -qO- http://backend:4000/health

# 4. Reconstruir frontend
docker compose up --build -d frontend

# 5. Comprovar configuració Nginx
docker compose exec frontend cat /etc/nginx/conf.d/default.conf
```

### 5. WebSocket no connecta

```bash
# 1. Comprovar que el backend està healthy
curl -s http://localhost/health

# 2. Verificar configuració Nginx per a /ws
docker compose exec frontend cat /etc/nginx/conf.d/default.conf | grep -A 10 "/ws"

# 3. Provar connexió WebSocket directa
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost/ws');
ws.on('open', () => { console.log('OK'); ws.close(); });
ws.on('error', (e) => console.error('ERROR:', e.message));
"

# 4. Comprovar logs del backend per a errors WS
docker compose logs backend | grep -i "websocket\|ws"
```

---

## Variables d'entorn

| Variable | Valor per defecte | Descripció |
|----------|-------------------|------------|
| `PORT` | `4000` | Port del backend (docker) |
| `DB_PATH` | `/app/data/data.db` | Ruta absoluta a la base de dades SQLite |
| `CORS_ORIGIN` | `http://localhost` | Origen permès per CORS |
| `ADMIN_PASSWORD` | `railboard` | Contrasenya d'admin (⚠️ canviar en producció) |
| `NODE_ENV` | (buit) | `production` activa optimitzacions |
| `RATE_LIMIT_MAX` | `120` | Màxim de peticions per minut |
| `VITE_API_URL` | (buit) | URL de l'API per al frontend |
| `HOST_PORT` | `80` | Port publicat del contenidor frontend |
