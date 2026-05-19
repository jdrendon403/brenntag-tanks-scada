# SCADA Tanques — Brenntag Barranquilla

Sistema Web-SCADA para monitoreo en tiempo real de 13 tanques cilíndricos. Comunicación Modbus TCP con PLC, persistencia en MongoDB, backend FastAPI, frontend React, orquestado en Docker Compose.

---

## Estructura del repositorio

```
Tanks/
├── plan.md                         # Plan de desarrollo por fases
├── documentacion_scada_tanques.md  # Especificación original del cliente
└── tanks-scada/
    ├── docker-compose.yml          # Orquestación de los 3 servicios
    ├── .env.example                # Variables de entorno de referencia
    ├── backend/
    │   ├── app/
    │   │   ├── main.py             # FastAPI lifespan + routers
    │   │   ├── core/
    │   │   │   ├── config.py       # Pydantic Settings (lee .env)
    │   │   │   └── database.py     # Motor async + seed 13 tanques + índices
    │   │   ├── modbus/
    │   │   │   ├── client.py       # ModbusClientWrapper (real + mock)
    │   │   │   └── poller.py       # Loop asyncio cada 1 s; publica al WS
    │   │   ├── models/
    │   │   │   ├── tank.py         # TankConfig, TankState, TankConfigUpdate
    │   │   │   ├── alarm.py        # AlarmRecord
    │   │   │   └── history.py      # HistoryRecord
    │   │   ├── routers/
    │   │   │   ├── tanks.py        # GET /api/tanks/, GET /api/tanks/{id}
    │   │   │   ├── config.py       # GET/PUT /api/config/tanks/{id}, GET /api/config/audit
    │   │   │   ├── alarms.py       # GET /api/alarms/, PATCH /{id}/ack, POST /reset
    │   │   │   ├── history.py      # GET /api/history/
    │   │   │   └── websocket.py    # WS /ws/live + WebSocketManager
    │   │   └── services/
    │   │       ├── calculator.py   # volumen / peso / porcentaje
    │   │       ├── alarm_service.py# detección, ACK, reset, recuperación al arranque
    │   │       └── datalogger.py   # snapshot MongoDB cada 60 s
    │   ├── requirements.txt
    │   ├── Dockerfile
    │   └── .env                    # desarrollo local (no commitear en prod)
    └── frontend/
        ├── src/
        │   ├── api/client.ts       # axios, URLs relativas (proxy Vite/Nginx)
        │   ├── hooks/useWebSocket.ts
        │   ├── context/TankDataContext.tsx
        │   ├── components/
        │   │   ├── AlarmBanner.tsx
        │   │   ├── TankIcon.tsx
        │   │   └── LevelBar.tsx
        │   └── pages/
        │       ├── GeneralView.tsx
        │       ├── TankDetail.tsx
        │       ├── Configuration.tsx
        │       ├── History.tsx
        │       └── Alarms.tsx
        ├── vite.config.ts          # proxy /api y /ws → app_scada:8000
        ├── tailwind.config.js
        ├── nginx.conf              # producción: sirve SPA + proxy API/WS
        ├── Dockerfile              # multi-stage: node build → nginx serve
        └── Dockerfile.dev          # dev: vite dev server con hot-reload
```

---

## Levantar el entorno

```bash
cd tanks-scada

# Desarrollo (hot-reload en backend y frontend)
docker compose up -d

# URLs
# Frontend : http://localhost:5173
# API REST : http://localhost:8000/api/
# WebSocket: ws://localhost:8000/ws/live
# Docs API : http://localhost:8000/docs
```

### Producción (un solo puerto HTTP)

```bash
cd tanks-scada
# 1. Crear .env.prod desde la plantilla
copy .env.prod.example .env.prod   # Windows
# cp .env.prod.example .env.prod   # Linux/Mac
# Editar .env.prod con los valores reales

# 2. Construir y levantar
make prod-build   # o: docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
make prod         # o: docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# URL única: http://<host>:80  (frontend + API + WS todo en el mismo puerto)
```

> **Nota:** prod usa un volumen `mongo_data_prod` separado del volumen de desarrollo `mongo_data`.
> Si es la primera vez, MongoDB crea las credenciales automáticamente desde `MONGO_USER/MONGO_PASSWORD`.

### Desarrollo (hot-reload)

Variables clave en `.env.example`:

| Variable          | Por defecto              | Descripción                              |
|-------------------|--------------------------|------------------------------------------|
| `MOCK_MODBUS`     | `true`                   | Simula PLC; `false` = conecta al PLC real |
| `PLC_HOST`        | `192.168.1.100`          | IP del PLC real                          |
| `PLC_PORT`        | `502`                    | Puerto Modbus TCP                        |
| `MONGODB_URI`     | `mongodb://db_scada:27017` | Cadena de conexión MongoDB             |
| `POLLING_INTERVAL`| `1.0`                    | Segundos entre lecturas Modbus           |

---

## API REST — referencia rápida

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/api/health` | Estado del servicio y conexión Modbus |
| `GET`  | `/api/tanks/` | Estado en tiempo real de los 13 tanques |
| `GET`  | `/api/tanks/{id}` | Estado de un tanque individual |
| `GET`  | `/api/config/tanks` | Configuración completa de los 13 tanques |
| `GET`  | `/api/config/tanks/{id}` | Configuración de un tanque |
| `PUT`  | `/api/config/tanks/{id}` | Actualizar configuración (guarda auditoría) |
| `GET`  | `/api/config/audit` | Log de cambios de configuración |
| `GET`  | `/api/alarms/` | Listado de alarmas (filtros: `active_only`, `tank_id`) |
| `PATCH`| `/api/alarms/{id}/ack` | Reconocer alarma (ACK) |
| `POST` | `/api/alarms/reset` | Escribir `True` al registro Modbus 30016 |
| `GET`  | `/api/history/` | Histórico (filtros: `tank_id`, `from`, `to`, `limit`) |
| `WS`   | `/ws/live` | Stream en tiempo real de todos los tanques (1 msg/s) |

---

## Mapa de registros Modbus

| Variable            | Registros     | Tipo    | FC   | Notas |
|---------------------|---------------|---------|------|-------|
| Altura TK1–TK13     | 10001–10026   | Float32 | FC04 | 2 registros por tanque, Big-Endian ABCD |
| Sobrellenado TK1–13 | 10027–10052   | Float32 | FC04 | 2 registros por tanque |
| SWTk1–SWTk13        | 30001–30013   | Bool    | FC02 | 1 registro por tanque |
| Alarma 1            | 30014         | Bool    | FC02 | Solo lectura |
| Alarma 2            | 30015         | Bool    | FC02 | Solo lectura |
| Reset Alarma        | 30016         | Bool    | FC05 | Escritura coil |

Todos los registros son configurables por tanque en MongoDB (`tanks_config.modbus`).

---

## Lógica de negocio

### Cálculos (services/calculator.py)
```
volumen (L)  = π × (diámetro/2)² × altura × 1000
peso (kg)    = volumen × densidad
porcentaje   = (altura / max_height) × 100  [clamp 0–100]
```

### Detección de alarma (services/alarm_service.py)
```
alarma = (altura > overflow_limit) OR (suiche == True)
```
- `overflow_limit` = `alarm_height` del config si está seteado, sino el valor del registro Modbus.
- Al detectar: inserta registro en `alarms` con `active=True`.
- Al resolver: actualiza `end_time` y `active=False`.
- Al arrancar: recupera alarmas activas de MongoDB para no perder estado tras reinicio.

### Datalogger (services/datalogger.py)
Guarda snapshot de todos los tanques en la colección `history` cada 60 segundos.

---

## Frontend — pantallas

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Vista General | `/` | Grid 13 tanques; borde rojo parpadeante en alarma; clic → detalle |
| Detalle | `/tank/:id` | 3 barras verticales + gráfico histórico recharts; selector de variable |
| Configuración | `/config?tank=N` | Formulario (dimensiones, producto, Modbus, alarm_height); tabla de auditoría |
| Histórico | `/history` | Filtros fecha/variable; gráfico + tabla; máx 1440 registros |
| Alarmas | `/alarms` | Tabla con ACK, filtros; botón Reset PLC |

**AlarmBanner**: visible en todas las rutas cuando hay alarma activa. Click derecho → reset Modbus.  
**WebSocket**: reconexión automática cada 3 s si cae la conexión.

---

## Fases del proyecto

- **Fase 1** ✅ Backend core: FastAPI, Modbus mock, MongoDB, routers base
- **Fase 2** ✅ Alarmas completas: ACK, recuperación al arranque, alarm_height override, audit log
- **Fase 3** ✅ WebSocket tiempo real (implementado dentro de Fase 1)
- **Fase 4** ✅ Frontend React: todas las 5 pantallas, TypeScript limpio, Tailwind
- **Fase 5** ✅ Docker producción: Nginx proxy + build multi-stage + `.env` de producción

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs -f app_scada
docker compose logs -f frontend

# Reiniciar solo el backend (aplica cambios de código sin rebuild)
docker compose restart app_scada

# Rebuild completo
docker compose build --no-cache

# Probar alarma manualmente (baja umbral de TK3 a 1.5 m)
curl -X PUT http://localhost:8000/api/config/tanks/3 \
  -H "Content-Type: application/json" \
  -d '{"alarm_height": 1.5}'

# Restaurar (usar valor del PLC)
curl -X PUT http://localhost:8000/api/config/tanks/3 \
  -H "Content-Type: application/json" \
  -d '{"alarm_height": null}'

# Conectar WebSocket manualmente
wscat -c ws://localhost:8000/ws/live
```
