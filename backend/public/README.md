# RailBoard Backend Dashboard

Dashboard y presentación del backend de RailBoard construido con **Tailwind CSS** y **Vanilla JavaScript**.

## 🚀 Acceso

**Local:** http://localhost:4000

## 📊 Características

### Navegación Principal

- **Resumen**: Información general del sistema
- **Estadísticas**: Contadores en vivo de trenes, operadores, tipos, destinos
- **API**: Documentación interactiva de todos los endpoints
- **Config**: Configuración actual del sistema

### Estadísticas en Vivo

- Número de trenes registrados
- Operadores disponibles
- Tipos de tren configurados
- Destinos registrados

### Explorador de API

Directamente desde el dashboard puedes:

- Ver todos los endpoints disponibles
- Probar endpoints con un clic
- Consultar respuestas en JSON

### Información de Sistema

- Estado de la conexión
- Uptime en tiempo real
- Estado del WebSocket
- Configuración actual (estación, modo, idioma, colores)

## 🎨 Diseño

- **Tema**: Board ferroviario con colores corporativos RailBoard
- **Responsive**: Mobile-first, optimizado para desktop
- **Tailwind CSS**: CDN con configuración personalizada
- **Monospace**: Font Display (Space Mono) para código

## 🔐 Autenticación

El dashboard hace requests autenticadas a las APIs usando:

```
Authorization: Basic admin:railboard
```

## 📡 Actualizaciones en Vivo

- **Estadísticas**: Se actualizan cada 5 segundos
- **Uptime**: Contador en tiempo real (cada segundo)
- **WebSocket**: Indicador de conexión ws://localhost:4000/ws

## 🔗 Enlaces Rápidos

- Admin Panel → `/admin`
- API Trains → `/admin/trains`
- API Config → `/admin/config`
- WebSocket → `ws://localhost:4000/ws`

---

_Construido con Node.js + Express + Tailwind CSS_
