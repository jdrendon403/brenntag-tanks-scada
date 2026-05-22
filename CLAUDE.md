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
    │   │   │   ├── config.py       # Pydantic Settings (lee .env); incluye AUTH_*
    │   │   │   ├── database.py     # Motor async + seed 13 tanques + carga tablas de aforo
    │   │   │   └── security.py     # create_token() + dependencia require_auth (JWT HS256)
    │   │   ├── modbus/
    │   │   │   ├── client.py       # ModbusClientWrapper (real + mock)
    │   │   │   └── poller.py       # Loop asyncio cada 1 s; publica al WS
    │   │   ├── models/
    │   │   │   ├── tank.py         # TankConfig, TankState, TankConfigUpdate, SensorRange
    │   │   │   ├── alarm.py        # AlarmRecord
    │   │   │   └── history.py      # HistoryRecord
    │   │   ├── routers/
    │   │   │   ├── auth.py         # POST /api/auth/login
    │   │   │   ├── tanks.py        # GET /api/tanks/, GET /api/tanks/{id}
    │   │   │   ├── config.py       # config CRUD + calibración CSV + escritura PLC (protegidos)
    │   │   │   ├── alarms.py       # GET /api/alarms/, PATCH /{id}/ack*, POST /reset* (*auth)
    │   │   │   ├── history.py      # GET /api/history/
    │   │   │   └── websocket.py    # WS /ws/live + WebSocketManager
    │   │   ├── services/
    │   │   │   ├── calculator.py   # volumen (tabla o fórmula) / peso / porcentaje
    │   │   │   ├── alarm_service.py# detección, ACK, reset, recuperación al arranque
    │   │   │   └── datalogger.py   # snapshot MongoDB cada 60 s
    │   │   └── data/calibration/   # Tablas de aforo SGS: tank_N.json
    │   ├── requirements.txt
    │   ├── Dockerfile
    │   └── .env                    # desarrollo local (no commitear en prod)
    └── frontend/
        ├── src/
        │   ├── api/client.ts       # axios, URLs relativas (proxy Vite/Nginx)
        │   ├── hooks/useWebSocket.ts
        │   ├── context/
        │   │   ├── TankDataContext.tsx  # estado global WebSocket
        │   │   ├── UnitContext.tsx      # unidades de visualización globales (localStorage)
        │   │   └── AuthContext.tsx      # token JWT en sessionStorage + interceptores axios
        │   ├── utils/units.ts      # conversión y formateo: altura, volumen
        │   ├── components/
        │   │   ├── AlarmBanner.tsx
        │   │   ├── TankIcon.tsx
        │   │   ├── LevelBar.tsx
        │   │   └── LoginModal.tsx  # modal overlay aparece automáticamente en 401
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

### Variables clave en `.env.example`

| Variable          | Por defecto              | Descripción                              |
|-------------------|--------------------------|------------------------------------------|
| `MOCK_MODBUS`     | `true`                   | Simula PLC; `false` = conecta al PLC real |
| `PLC_HOST`        | `192.168.1.100`          | IP del PLC real                          |
| `PLC_PORT`        | `502`                    | Puerto Modbus TCP                        |
| `MONGODB_URI`     | `mongodb://db_scada:27017` | Cadena de conexión MongoDB             |
| `POLLING_INTERVAL`| `1.0`                    | Segundos entre lecturas Modbus           |
| `AUTH_USER`       | `admin`                  | Usuario para acceso a escritura          |
| `AUTH_PASSWORD`   | `scada1234`              | Contraseña (**cambiar en producción**)   |
| `AUTH_SECRET`     | `cambia-este-secreto`    | Clave secreta JWT (**cambiar en producción**) |

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
| `POST` | `/api/config/tanks/{id}/calibration` | Subir tabla de aforo desde CSV |
| `POST` | `/api/config/tanks/{id}/sensor-range/write` | Enviar rango del sensor al PLC (FC16) |
| `POST` | `/api/config/tanks/{id}/overflow-limit/write` | Enviar límite sobrellenado al PLC (FC16) |
| `GET`  | `/api/config/plc` | Info de conexión PLC (host, puerto, modo mock) |
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
| SWTk1–SWTk13        | 30001–30013   | Bool    | **FC01** | dirección = registro − 30001 |
| Alarma 1            | 30014         | Bool    | FC01 | Solo lectura |
| Alarma 2            | 30015         | Bool    | FC01 | Solo lectura |
| Reset Alarma        | 30016         | Bool    | FC05 | Escritura coil |
| Rango sensor min/max | configurable | Float32 | FC16 | Holding; dirección = registro − 1 |
| Límite sobrellenado | configurable  | Float32 | FC16 | Usa overflow_register; dirección = registro − 1 |

Todos los registros son configurables por tanque en MongoDB (`tanks_config.modbus`).

---

## Lógica de negocio

### Cálculos (services/calculator.py)

Con tabla de aforo cargada:
```
volumen (L)  = interpolación lineal en tabla de aforo (height_mm → volume_l)
porcentaje   = (volumen / volumen_máximo_tabla) × 100  [clamp 0–100]
peso (kg)    = volumen × densidad
```

Sin tabla (fallback):
```
volumen (L)  = π × (diámetro/2)² × altura × 1000
porcentaje   = (altura / max_height) × 100  [clamp 0–100]
```

### Tablas de aforo (data/calibration/tank_N.json)

- Formato: `{"table": [{"height_mm": float, "volume_l": float}, ...]}`
- Alturas en mm desde el fondo del tanque, orden ascendente.
- Cargadas automáticamente al seed al arrancar si el archivo existe.
- También cargables desde la UI vía CSV (`height_mm`, `volume_l`).

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
| Configuración | `/config?tank=N` | Producto, densidad, Modbus, sensor range, tabla de aforo editable, alarma |
| Histórico | `/history` | Filtros fecha/variable; gráfico + tabla; máx 1440 registros |
| Alarmas | `/alarms` | Tabla con ACK, filtros; botón Reset PLC |

**AlarmBanner**: visible en todas las rutas cuando hay alarma activa. Click derecho → reset Modbus.  
**WebSocket**: reconexión automática cada 3 s si cae la conexión.

### Unidades de visualización (UnitContext)

Seleccionables globalmente desde la pantalla de Configuración; se persisten en `localStorage` (`scada_display_units`).

| Variable | Opciones | Por defecto |
|----------|----------|-------------|
| Nivel / Altura | mm, cm, m | cm |
| Volumen | L, gal US | L |
| Peso | kg | kg (fijo) |

### Pantalla Configuración — secciones

- **Unidades de visualización** — selector global (borde índigo).
- **Producto** — nombre y producto del tanque.
- **Propiedades del producto** — densidad (kg/L).
- **Alarma de Sobrellenado** — checkbox para activar override; campo altura; botón **"Enviar al PLC"** (naranja) escribe al `overflow_register` vía FC16.
- **Registros Modbus — Lectura** — height, overflow, switch registers.
- **Rango del Sensor de Nivel** — min/max valor + registros holding; botón **"Enviar al PLC"** (ámbar) escribe vía FC16.
- **Tabla de Aforo** — visor/editor con filtro, edición inline, agregar/eliminar filas; carga CSV completa.
- **Historial de cambios** — últimas 20 entradas del audit log.

---

## Fases del proyecto

- **Fase 1** ✅ Backend core: FastAPI, Modbus mock, MongoDB, routers base
- **Fase 2** ✅ Alarmas completas: ACK, recuperación al arranque, alarm_height override, audit log
- **Fase 3** ✅ WebSocket tiempo real (implementado dentro de Fase 1)
- **Fase 4** ✅ Frontend React: todas las 5 pantallas, TypeScript limpio, Tailwind
- **Fase 5** ✅ Docker producción: Nginx proxy + build multi-stage + `.env` de producción
- **Fase 6** ✅ Tablas de aforo SGS: interpolación lineal, carga CSV, editor UI, JSON por tanque
- **Fase 7** ✅ Unidades de visualización: mm/cm/m + L/gal, UnitContext global
- **Fase 8** ✅ Rango de sensor + límite sobrellenado escritura al PLC (FC16); corrección FC01 suiche

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

# Cargar tabla de aforo desde CSV para TK1
curl -X POST http://localhost:8000/api/config/tanks/1/calibration \
  -F "file=@tabla_tk1.csv"

# Enviar rango del sensor al PLC (requiere sensor_range configurado)
curl -X POST http://localhost:8000/api/config/tanks/1/sensor-range/write

# Enviar límite de sobrellenado al PLC (requiere alarm_height configurado)
curl -X POST http://localhost:8000/api/config/tanks/1/overflow-limit/write

# Conectar WebSocket manualmente
wscat -c ws://localhost:8000/ws/live
```
