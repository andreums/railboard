# Auditoría de Seguridad — Railboard

**Fecha:** 30 Mayo 2026  
**Objetivo:** Revisión de seguridad práctica para proyecto hobby ferroviario  
**Entorno esperado:** Local, red doméstica, encuentros modulares, posible VPS pequeño

---

## Resumen Ejecutivo

Railboard es un proyecto bien construido para su propósito. Los riesgos son **bajos en entornos locales/domésticos** pero **altos si se expone en Internet sin cambios**. El riesgo principal es la falta total de autenticación: cualquiera que descubra la URL puede modificar el panel de una estación, crear o eliminar trenes, borrar la base de datos completa y subir archivos arbitrarios (logos).

**Puntuación de riesgo general:**

- Entorno local: **1/10** (seguro por aislamiento de red)
- Encuentro modular (red local compartida): **3/10**
- Internet/VPS sin cambios: **8/10**

---

## Tabla de Riesgos

| #   | Riesgo                                               | Impacto | Probabilidad                    | Prioridad   |
| --- | ---------------------------------------------------- | ------- | ------------------------------- | ----------- |
| 1   | Ausencia total de autenticación                      | Alto    | Alta en Internet                | **CRÍTICO** |
| 2   | Subida de archivos sin validar                       | Alto    | Media                           | **ALTO**    |
| 3   | CORS abierto (`app.use(cors())`)                     | Medio   | Alta en Internet                | **ALTO**    |
| 4   | Sin rate limiting en endpoints                       | Medio   | Alta                            | **ALTO**    |
| 5   | Borrado masivo sin protección (`DELETE /api/trains`) | Alto    | Baja (intencional)              | **ALTO**    |
| 6   | Sin cabeceras de seguridad HTTP                      | Medio   | Media en Internet               | **MEDIO**   |
| 7   | Archivos subidos en repositorio Git                  | Medio   | Alta                            | **MEDIO**   |
| 8   | Base de datos SQLite incluida en Git                 | Medio   | Alta                            | **MEDIO**   |
| 9   | URL de logo con espacios en `api.ts` (bug)           | Bajo    | Alta                            | **BAJO**    |
| 10  | Manejo de errores sin sanitización                   | Bajo    | Media                           | **BAJO**    |
| 11  | Posible XSS en observaciones/paradas                 | Bajo    | Baja (React escapa por defecto) | **BAJO**    |
| 12  | Token de API expuesto sin prefijo VITE_              | Bajo    | Alta                            | **BAJO**    |

---

## 1. Superficie de Exposición

### Estado actual

Todas las rutas son completamente públicas:

| Ruta Frontend     | Acceso             | Contenido                                         |
| ----------------- | ------------------ | ------------------------------------------------- |
| `/`               | Público            | Display de trenes (lectura)                       |
| `/admin`          | **Sin protección** | Configuración, estilos, borrado masivo, seed data |
| `/trains`         | **Sin protección** | CRUD completo de trenes, reordenación             |
| `/train-settings` | **Sin protección** | CRUD de operadores y tipos de tren                |

### Riesgos

**En encuentro modular (red WiFi compartida):**

- Cualquier asistente con conocimientos básicos puede abrir `http://<ip>:5173/admin` y cambiar la configuración
- Pueden borrar todos los trenes o llenar el panel con datos falsos

**En Internet/VPS:**

- Escáneres automáticos encontrarán los endpoints en minutos
- Un script de 5 líneas puede llamar `DELETE /api/trains` y vaciar toda la BD
- Pueden usarse los endpoints de subida de archivos para almacenar contenido arbitrario

### Recomendación

Separar la app en dos modos o usar un proxy inverso:

```
/         → Display público (solo lectura)
/admin/*  → Autenticación requerida
/api/*    → Autenticación requerida para escritura
```

---

## 2. Backend Express

### 2.1 Configuración de Express

**Hallazgo:** El backend es mínimo y funcional, pero carece de prácticas de seguridad básicas.

```javascript
// index.js - actual
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
app.use("/api", routes);
app.get("/health", (_req, res) => res.json({ ok: true }));
```

### 2.2 CORS

**Hallazgo CRÍTICO:** `app.use(cors())` sin opciones permite cualquier origen.

```javascript
// Actual - cualquier web puede hacer peticiones
app.use(cors());

// Recomendado
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
```

### 2.3 Cabeceras HTTP

**Hallazgo:** No se usa `helmet`. El servidor no envía cabeceras de seguridad como `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`.

```bash
npm install helmet
```

```javascript
import helmet from "helmet";
app.use(helmet());
```

### 2.4 Validación de Entradas

**Hallazgo MEDIO:** `setConfig` escribe cualquier clave-valor sin validación. Un atacante podría escribir claves inesperadas.

```javascript
// routes.js:528
r.put("/config", (req, res) => {
  setConfig(req.body || {}); // Cualquier cosa del body se guarda
  ping();
  res.json(getConfig());
});

// db.js:84
export function setConfig(patch) {
  const stmt = db.prepare("INSERT INTO config ...");
  for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v));
}
```

**Impacto bajo en sí mismo** (solo afecta a la tabla config), pero la falta de validación es un patrón que se repite.

### 2.5 Manejo de Errores

**Hallazgo BAJO:** No hay middleware global de errores. Errores de base de datos o parseo de JSON pueden filtrar trazas. Actualmente el error se propaga:

```javascript
// Sin middleware de errores
// Cualquier throw en routes.js devuelve un 500 sin procesar
```

**Recomendación:**

```javascript
// Middleware global de errores (antes del listen)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});
```

### 2.6 Rate Limiting

**Hallazgo ALTO:** No hay límite de peticiones. Un atacante puede:

- `POST /api/generate-random-train` miles de veces → llenar la BD
- `DELETE /api/trains` repetidamente
- Saturación de WebSocket por broadcast constante

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  message: { error: "Demasiadas peticiones" },
});
app.use("/api", apiLimiter);

// Límite más estricto para escritura
const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
});
app.use("/api/trains", writeLimiter); // POST/PUT/DELETE
```

### 2.7 Subida de Archivos (Multer)

**Hallazgo ALTO:** La configuración de multer acepta **cualquier tipo de archivo**. No se valida MIME type ni contenido.

```javascript
// actual - solo hay límite de tamaño
const upload = multer({
  storage: multer.diskStorage({ ... }),
  limits: { fileSize: 2 * 1024 * 1024 },
  // ❌ Sin fileFilter
});
```

**Riesgo:** Alguien podría subir un `.html` con JavaScript malicioso y luego acceder a `http://<server>/uploads/evil.html`. Aunque los navegadores modernos tienen protecciones, sigue siendo un riesgo evitar.

```javascript
// Recomendado - validar por MIME type y extensión
const upload = multer({
  storage: multer.diskStorage({ ... }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de archivo no permitido. Solo imágenes."));
    }
  },
});
```

### 2.8 Borrado Masivo sin Protección

**Hallazgo ALTO:** `DELETE /api/trains` borra todos los trenes sin confirmación ni protección.

```javascript
// routes.js:536
r.delete("/trains", (_req, res) => {
  db.exec("DELETE FROM trains");
  ping();
  res.status(204).end();
});
```

**Recomendación:**

```javascript
r.delete("/trains", (req, res) => {
  // En modo autenticado esto estaría bien,
  // pero al menos añadir un header de confirmación
  if (req.headers["x-confirm"] !== "yes") {
    return res.status(400).json({ error: "Requiere header X-Confirm: yes" });
  }
  db.exec("DELETE FROM trains");
  ping();
  res.status(204).end();
});
```

---

## 3. SQLite y Acceso a Datos

### 3.1 SQL Injection

**Hallazgo:** **No hay riesgo de SQL injection.** `better-sqlite3` usa prepared statements 100% del tiempo. Todos los queries usan parámetros con `?` o `@named`. Buen trabajo.

```javascript
// ✅ Patrón seguro - prepared statements siempre
db.prepare("UPDATE trains SET sort_order = ? WHERE id = ?").run(idx, id);
db.prepare("SELECT * FROM trains WHERE id = ?").get(id);
```

### 3.2 Archivo de Base de Datos en Git

**Hallazgo:** La BD NO está en Git gracias al `.gitignore`, pero hay un conflicto de merge sin resolver en `.gitignore`:

```gitignore
<<<<<<< HEAD
... (plantilla genérica)
=======
data.db
data.db-shm
data.db-wal
...
>>>>>>> 8b751a4
```

**Riesgo MEDIO:** El `.gitignore` tiene marcadores de conflicto de merge. Si alguien hace `git add .` sin revisar, la BD podría terminar en el repositorio. Además, incluye `backend/uploads/*` que oculta archivos subidos que pueden tener contenido sensible.

### 3.3 Backups

No hay estrategia de backup. Para un proyecto hobby no es crítico, pero para encuentros modulares sería útil un backup rápido:

```bash
# Opción simple - cron diario
cp data.db "data.db.$(date +%Y%m%d)"
```

---

## 4. WebSocket

### 4.1 Estado Actual

```javascript
// ws.js - completamente abierto
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "hello" }));
  // No escucha mensajes entrantes
});

// broadcast a todos los clientes
export function broadcast(payload) {
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}
```

### 4.2 Riesgos

| Riesgo                            | Realidad                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Conexiones no autenticadas        | Cualquiera puede conectarse al WS y recibir todas las actualizaciones → **Esto es intencional y correcto para el display público** |
| Spam/flooding                     | El servidor WS **no recibe mensajes** de clientes. Solo emite. No hay riesgo de flooding desde el WS. **Bien diseñado.**           |
| Clientes maliciosos reciben datos | Leer el flujo de cambios no da capacidad de modificar datos. **Riesgo bajo.**                                                      |

### 4.3 Conclusión sobre WebSocket

El WebSocket está bien diseñado para este proyecto: es **solo de emisión** (broadcast). Los clientes no pueden enviar comandos por WS. No necesita cambios para el caso de uso actual.

---

## 5. Frontend React

### 5.1 XSS

**Hallazgo:** **Riesgo BAJO.** React escapa valores por defecto en JSX. Sin embargo, hay puntos a revisar:

```tsx
// Display.tsx:121 - ScrollText renderiza texto directamente
<span>{text}</span>
// ✅ Seguro - React escapa string interpolation

// Admin.tsx:152 - logo_url puede ser data URL
<img src={config.logo_url} />
// ⚠️ Riesgo teórico si es `javascript:` pero los navegadores modernos lo bloquean
```

**No se usa** `dangerouslySetInnerHTML` en ningún componente. Buen trabajo.

### 5.2 Observaciones y Paradas

Los campos `observations` y `stops` pueden contener cualquier texto, pero React lo renderiza como texto escapado:

```tsx
// Trains.tsx:246
<div title={train.observations}>{train.observations}</div>
// ✅ Seguro - React escapa title y contenido
```

### 5.3 URLs de Logos

```tsx
// Display.tsx:401-413
<img src={fileUrl(train.type_logo)!} alt={train.type_code || ""} />
```

La función `fileUrl` antepone `API_URL` si la URL no empieza con `http`. El `!` (non-null assertion) es inseguro pero en la práctica `fileUrl` solo retorna null si el input es null/undefined.

### 5.4 Variables de Entorno en Vite

```typescript
// api.ts:1
export const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:4000";
```

**Hallazgo:** `VITE_*` variables se exponen en el bundle del frontend. Esto es correcto y esperado (Vite las inyecta). No hay secretos en variables de entorno del frontend. El fallback `http://localhost:4000` sí se filtra, pero es la URL del backend, no un secreto.

### 5.5 Bug: Rutas API con espacios

**Hallazgo BAJO:** En `api.ts` hay espacios en las plantillas de URL:

```typescript
// api.ts:76-78
addDelay: (id, minutes) =>
  json(`/trains/${id} / delay`, ...),  // ❌ espacio antes de /delay
setPlatform: (id, platform, sector) =>
  json(`/ trains / ${id}/platform`, ...),  // ❌ espacios
```

Esto causará **404** en producción. Las rutas reales son `/trains/:id/delay` y `/trains/:id/platform`.

---

## 6. Autenticación y Autorización

### Propuesta para este proyecto

Dado que Railboard es un proyecto hobby, propongo una solución **proporcional al riesgo**:

#### Opción A: Basic Auth (Recomendada para VPS)

Simple, soportada por Nginx/Caddy, fácil de configurar.

**A nivel de aplicación (mínimo esfuerzo):**

```bash
npm install express-basic-auth
```

```javascript
// routes.js - proteger solo rutas de escritura
import basicAuth from "express-basic-auth";

const adminAuth = basicAuth({
  users: { admin: process.env.ADMIN_PASSWORD || "railboard" },
  challenge: true,
});

// Proteger rutas de escritura
r.post("/trains", adminAuth, (req, res) => { ... });
r.put("/trains/:id", adminAuth, (req, res) => { ... });
r.delete("/trains", adminAuth, (req, res) => { ... });
// ... etc para operadores, tipos, lugares, config, seed
```

**A nivel de proxy inverso (mejor):**

```nginx
# Nginx
location /admin/ {
    proxy_pass http://localhost:4000/;
    auth_basic "Railboard Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
}

location /api/ {
    # Solo GET permitido sin auth
    limit_except GET {
        auth_basic "Railboard Admin";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
    proxy_pass http://localhost:4000;
}
```

#### Opción B: Token simple en localStorage

Para entornos donde no se puede configurar el proxy:

1. El admin establece un token en el panel de configuración
2. El backend verifica `Authorization: Bearer <token>` en cada petición de escritura
3. Si no hay token configurado, funciona sin auth (modo local)

#### Opción C: Cookie de sesión (más elaborada)

- Login en `/api/login` con contraseña fija
- Sesión vía `express-session` o JWT firmado
- El frontend redirige a login si no hay sesión

**Recomendación para cada escenario:**

| Escenario         | Opción recomendada                     |
| ----------------- | -------------------------------------- |
| Solo localhost    | No hacer nada (riesgo 1/10)            |
| Red doméstica     | Opción A en Nginx/Caddy                |
| Encuentro modular | Opción B (token en localStorage)       |
| VPS/Internet      | Opción A (Basic Auth en Nginx) + HTTPS |

---

## 7. Seguridad de Despliegue

### 7.1 Variables de Entorno

```bash
# backend/.env
PORT=4000
ADMIN_PASSWORD=cambia-esto
CORS_ORIGIN=https://railboard.midominio.com
NODE_ENV=production

# frontend/.env
VITE_API_URL=https://railboard.midominio.com/api
```

### 7.2 Puertos

| Puerto | Servicio        | Exponer en Internet     |
| ------ | --------------- | ----------------------- |
| 5173   | Vite dev server | **NUNCA**               |
| 4000   | Express backend | Solo tras proxy inverso |
| 80/443 | Nginx/Caddy     | Sí (HTTPS)              |

**Regla de oro:** Nunca expongas el puerto de desarrollo de Vite (5173) ni Express directo (4000). Usa siempre un proxy inverso.

### 7.3 Reverse Proxy con Caddy (recomendado)

```
railboard.midominio.com {
    reverse_proxy /api/* localhost:4000
    reverse_proxy /uploads/* localhost:4000
    reverse_proxy /ws/* localhost:4000
    reverse_proxy /* localhost:5173 {
        header_up Host {host}
    }
    basicauth /api/* {
        admin $2a...hashdecontraseña
    }
}
```

### 7.4 HTTPS

Usa Caddy (automático con Let's Encrypt) o Nginx + certbot. Para entornos locales, un certificado autofirmado o simplemente HTTP es aceptable.

### 7.5 Firewall

```bash
# En VPS: Solo puertos 22 (SSH), 80, 443
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 4000  # Express no debe estar expuesto
sudo ufw deny 5173  # Vite no debe estar expuesto
sudo ufw enable
```

### 7.6 Archivos en `.gitignore`

**Arreglar el conflicto de merge en `.gitignore`:**

```gitignore
node_modules/
dist/
backend/data.db
backend/data.db-shm
backend/data.db-wal
backend/uploads/*
!backend/uploads/.gitkeep
.env
.DS_Store
*.log
*.pid
```

Además, los archivos `backend/data.db-shm` y `backend/data.db-wal` están actualmente en el repositorio (no ignorados por el conflicto de merge).

### 7.7 Backups

```bash
#!/bin/bash
# /etc/cron.daily/railboard-backup
cp /opt/railboard/backend/data.db "/opt/railboard/backups/data.db.$(date +%Y%m%d)"
find /opt/railboard/backups -name "*.db.*" -mtime +30 -delete
```

---

## 8. Dependencias

### 8.1 npm audit

```
Frontend: 2 moderate severity vulnerabilities
- esbuild (via vite)
- Vite dev server puede permitir lectura de respuestas

Backend: 0 vulnerabilities
```

### 8.2 Paquetes Recomendados

| Paquete              | Propósito                   | Prioridad |
| -------------------- | --------------------------- | --------- |
| `helmet`             | Cabeceras de seguridad HTTP | **Alta**  |
| `express-rate-limit` | Rate limiting               | **Alta**  |
| `express-basic-auth` | Autenticación simple        | **Media** |
| `zod` o `joi`        | Validación de esquemas      | **Baja**  |

### 8.3 `react-beautiful-dnd`

**Hallazgo:** Está en `package.json` pero no se usa (el proyecto usa `@dnd-kit`). Se puede eliminar.

---

## 9. Modelo de Amenazas

### Actores

| Actor                    | Descripción                                             |
| ------------------------ | ------------------------------------------------------- |
| **Usuario normal**       | Mira el display público, no tiene intención maliciosa   |
| **Curioso en red local** | Asistente a encuentro que encuentra el panel admin      |
| **Scraper automático**   | Bot que escanea Internet en busca de endpoints abiertos |
| **Atacante malicioso**   | Persona con intención de causar daño                    |
| **Niño en encuentro**    | Niño que toca botones por accidente o curiosidad        |

### Matriz de Amenazas

| Amenaza                                     | Actor        | Impacto                         | Probabilidad                    | Mitigación                     | Prioridad |
| ------------------------------------------- | ------------ | ------------------------------- | ------------------------------- | ------------------------------ | --------- |
| Borrar todos los trenes                     | Curioso/Niño | Alto (pérdida de configuración) | Media en encuentro              | Rate limiting + básica auth    | **Alta**  |
| Modificar display (cambiar nombre, colores) | Curioso      | Bajo (solo estético)            | Alta en encuentro               | Separar modo admin del público | **Media** |
| Subir archivos maliciosos                   | Atacante     | Alto (potencial RCE)            | Baja                            | Validar MIME + extensiones     | **Alta**  |
| Saturar BD con trenes aleatorios            | Scraper      | Medio (llenado de BD)           | Baja                            | Rate limiting                  | **Alta**  |
| Acceder a BD desde Internet                 | Scraper      | Bajo (BD no expuesta)           | Baja                            | No exponer SQLite              | **Baja**  |
| Modificar display desde Internet            | Atacante     | Medio (vandalismo)              | Baja (si se despliega con auth) | Autenticación + HTTPS          | **Alta**  |

---

## 10. Checklist Final

### 🔴 Crítico (antes de publicar en Internet)

- [ ] Añadir autenticación a rutas de escritura (Basic Auth o token)
- [ ] Validar tipo de archivo en multer (`fileFilter`)
- [ ] Añadir rate limiting a `/api`
- [ ] Añadir helmet para cabeceras HTTP
- [ ] Configurar CORS con origen específico
- [ ] No exponer puertos de dev (5173, 4000) directamente
- [ ] Configurar HTTPS
- [ ] Arreglar conflicto de merge en `.gitignore`

### 🟡 Recomendado (antes de usar en un encuentro)

- [ ] Añadir confirmación o header especial para `DELETE /api/trains`
- [ ] Poner una pantalla de "modo quiosco" en `/` que oculte la URL
- [ ] Configurar Basic Auth en el proxy inverso o en Express
- [ ] Separar red WiFi de administración de red de display público
- [ ] Añadir middleware de errores global
- [ ] Eliminar `react-beautiful-dnd` de dependencias no usadas

### 🟢 Mejoras futuras

- [ ] Arreglar espacios en URLs de `addDelay` y `setPlatform` en `api.ts`
- [ ] Validación de esquemas con Zod en endpoints POST/PUT
- [ ] Logging estructurado (pino, winston)
- [ ] Backup automático de la BD
- [ ] Tests de seguridad básicos
- [ ] Considerar Docker para despliegue reproducible
- [ ] Añadir `npm audit` al CI
- [ ] Paginación en listado de trenes (si hay cientos)
- [ ] Endpoint de estadísticas/health más detallado
- [ ] Timeout de sesión para admin (si se implementa login)

---

## Resumen de Hallazgos por Archivo

| Archivo                       | Línea                     | Hallazgo                        | Severidad   |
| ----------------------------- | ------------------------- | ------------------------------- | ----------- |
| `backend/src/index.js:12`     | `app.use(cors())`         | CORS sin restricciones          | **ALTO**    |
| `backend/src/index.js`        | Sin helmet                | Cabeceras HTTP faltantes        | **MEDIO**   |
| `backend/src/index.js`        | Sin rate limiting         | Sin protección contra abuso     | **ALTO**    |
| `backend/src/index.js`        | Sin error handler         | Trazas de error expuestas       | **BAJO**    |
| `backend/src/routes.js`       | Múltiples endpoints       | Sin autenticación               | **CRÍTICO** |
| `backend/src/routes.js:528`   | `setConfig(req.body)`     | Sin validación de entrada       | **MEDIO**   |
| `backend/src/routes.js:536`   | `DELETE /api/trains`      | Borrado masivo sin protección   | **ALTO**    |
| `backend/src/routes.js:16-25` | `multer` sin `fileFilter` | Subida de archivos arbitrarios  | **ALTO**    |
| `frontend/src/lib/api.ts:76`  | `" / delay"`              | Bug en URL (espacio)            | **BAJO**    |
| `frontend/src/lib/api.ts:78`  | `"/ / trains / "`         | Bug en URL (espacio)            | **BAJO**    |
| `.gitignore`                  | Línea 1-155               | Conflicto de merge sin resolver | **MEDIO**   |
| `backend/data.db-shm`         | En repositorio            | Archivo BD en Git               | **MEDIO**   |
| `backend/data.db-wal`         | En repositorio            | Archivo BD en Git               | **MEDIO**   |

---

_Auditoría generada para Railboard. Este es un proyecto hobby — implementa las correcciones críticas si lo expones en Internet, y las recomendaciones para encuentros según tu nivel de comodidad con el riesgo._
