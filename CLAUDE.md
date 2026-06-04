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
    │   │   │   ├── config.py       # Pydantic Settings (lee .env); incluye AUTH_* y MODBUS_WORD_SWAP
    │   │   │   ├── database.py     # Motor async + seed 13 tanques + carga tablas de aforo + seed alarm_config
    │   │   │   └── security.py     # create_token() + dependencia require_auth (JWT HS256)
    │   │   ├── modbus/
    │   │   │   ├── client.py       # ModbusClientWrapper (real + mock); reconexión automática; WORD_SWAP
    │   │   │   └── poller.py       # Loop asyncio cada 1 s; publica modbus_connected al WS
    │   │   ├── models/
    │   │   │   ├── tank.py         # TankConfig, TankState, TankConfigUpdate, SensorRange
    │   │   │   ├── alarm.py        # AlarmRecord
    │   │   │   └── history.py      # HistoryRecord
    │   │   ├── routers/
    │   │   │   ├── auth.py         # POST /api/auth/login
    │   │   │   ├── tanks.py        # GET /api/tanks/, GET /api/tanks/{id}
    │   │   │   ├── config.py       # config CRUD + calibración CSV + escritura PLC (protegidos)
    │   │   │   ├── alarms.py       # GET /api/alarms/, PATCH /{id}/ack*, POST /reset*, GET+PUT /config* (*auth)
    │   │   │   ├── history.py      # GET /api/history/
    │   │   │   └── websocket.py    # WS /ws/live + WebSocketManager
    │   │   ├── services/
    │   │   │   ├── calculator.py   # volumen (tabla o fórmula) / peso / porcentaje
    │   │   │   ├── alarm_service.py# detección, ACK, reset (solo True), recuperación al arranque
    │   │   │   └── datalogger.py   # snapshot MongoDB cada 60 s
    │   │   └── data/calibration/   # Tablas de aforo SGS: tank_N.json
    │   ├── requirements.txt
    │   ├── Dockerfile
    │   └── .env                    # desarrollo local (no commitear en prod)
    └── frontend/
        ├── public/
        │   └── favicon.svg         # Símbolo B de Brenntag (gradiente púrpura→azul)
        ├── src/
        │   ├── api/client.ts       # axios, URLs relativas (proxy Vite/Nginx)
        │   ├── hooks/useWebSocket.ts
        │   ├── context/
        │   │   ├── TankDataContext.tsx  # estado global WS; expone wsConnected + modbusConnected
        │   │   ├── UnitContext.tsx      # unidades de visualización globales (localStorage)
        │   │   └── AuthContext.tsx      # token JWT en sessionStorage + interceptores axios
        │   ├── utils/units.ts      # conversión y formateo: altura, volumen
        │   ├── components/
        │   │   ├── AlarmBanner.tsx  # botón Silenciar con feedback visual
        │   │   ├── TankIcon.tsx
        │   │   ├── LevelBar.tsx
        │   │   └── LoginModal.tsx  # modal overlay aparece automáticamente en 401
        │   └── pages/
        │       ├── GeneralView.tsx
        │       ├── TankDetail.tsx
        │       ├── Configuration.tsx  # botones "Guardar y enviar al PLC" unificados
        │       ├── History.tsx
        │       └── Alarms.tsx         # panel Registros Modbus configurable
        ├── imagens/
        │   └── brenntaglogo.svg    # Logo original Brenntag (fuente para logo y favicon)
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

### Variables clave en `.env.example`

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `MOCK_MODBUS` | `true` | Simula PLC; `false` = conecta al PLC real |
| `PLC_HOST` | `192.168.1.100` | IP del PLC real |
| `PLC_PORT` | `502` | Puerto Modbus TCP |
| `MODBUS_WORD_SWAP` | `false` | `true` = orden CDAB para Float32 (segundo PLC) |
| `MONGODB_URI` | `mongodb://db_scada:27017` | Cadena de conexión MongoDB |
| `POLLING_INTERVAL` | `1.0` | Segundos entre lecturas Modbus |
| `AUTH_USER` | `admin` | Usuario para acceso a escritura |
| `AUTH_PASSWORD` | `scada1234` | Contraseña (**cambiar en producción**) |
| `AUTH_SECRET` | `cambia-este-secreto` | Clave secreta JWT (**cambiar en producción**) |

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
| `POST` | `/api/config/tanks/{id}/sensor-range/write` | Guardar y enviar rango del sensor al PLC (FC16) |
| `POST` | `/api/config/tanks/{id}/overflow-limit/write` | Guardar y enviar límite sobrellenado al PLC (FC16) |
| `GET`  | `/api/config/plc` | Info de conexión PLC (host, puerto, modo mock) |
| `GET`  | `/api/config/audit` | Log de cambios de configuración |
| `GET`  | `/api/alarms/` | Listado de alarmas (filtros: `active_only`, `tank_id`) |
| `PATCH`| `/api/alarms/{id}/ack` | Reconocer alarma (ACK) |
| `POST` | `/api/alarms/reset` | Escribe True al registro de reset configurado (FC05) |
| `GET`  | `/api/alarms/config` | Lee registros Modbus de alarma global |
| `PUT`  | `/api/alarms/config` | Actualiza registros Modbus de alarma global |
| `GET`  | `/api/history/` | Histórico (filtros: `tank_id`, `from`, `to`, `limit`) |
| `WS`   | `/ws/live` | Stream en tiempo real; incluye `modbus_connected` |

---

## Mapa de registros Modbus

> El PLC envía y recibe **todas las alturas en milímetros**. El backend divide por 1000 al leer y multiplica por 1000 al escribir.

| Variable | Registros | Tipo | FC | Notas |
|----------|-----------|------|----|-------|
| Altura TK1–TK13 | 10001–10026 | Float32 | **FC03** | 2 regs por tanque; valor en mm |
| Sobrellenado TK1–TK13 | 10301–10326 | Float32 | **FC03** | 2 regs por tanque; valor en mm |
| Sensor mín. TK1–TK13 | 10101–10126 | Float32 | FC03 / FC16 | Lectura FC03; escritura FC16; valor en mm |
| Sensor máx. TK1–TK13 | 10201–10226 | Float32 | FC03 / FC16 | Lectura FC03; escritura FC16; valor en mm |
| SWTk1–SWTk13 | 6001–6013 | Bool | **FC01** | dirección = registro − 1 |
| Alarma DPS | configurable (def. 6051) | Bool | FC01 | Solo lectura; genera alarma sistema (tank_id=0, origin='dps') |
| Alarma Monitor de Fase | configurable (def. 6052) | Bool | FC01 | Solo lectura; genera alarma sistema (tank_id=0, origin='phase') |
| Reset Alarma | configurable (def. 6053) | Bool | FC05 | Solo envía True; el PLC resetea a False |

Todos los registros por tanque son configurables en MongoDB (`tanks_config.modbus`).
Los registros de alarma global se guardan en la colección `alarm_config`.

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

**Alarmas por tanque (tank_id 1–13):**
```
alarma = (altura_m > overflow_limit_m) OR (suiche == True)
```
- `overflow_limit` = `alarm_height` del config (en metros) si está seteado, sino el valor del registro Modbus dividido por 1000.
- `origin`: `'height'` o `'switch'`.

**Alarmas de sistema (tank_id=0):**
- `check_system_alarms(alarm1, alarm2, db)` llamado desde `_poll_once()` después de leer los coils de alarma.
- `origin='dps'` (Alarma DPS, coil alarm1_register) y `origin='phase'` (Monitor de Fase, coil alarm2_register).
- Aparecen en el `AlarmBanner` con su nombre completo y en la tabla de Alarmas bajo columna "Sistema".

**Comportamiento común:**
- Al detectar: inserta registro en `alarms` con `active=True`.
- Al resolver: actualiza `end_time` y `active=False`.
- Al arrancar: recupera todas las alarmas activas de MongoDB (tanques y sistema) para no perder estado tras reinicio.

### Reset de alarma
- `POST /api/alarms/reset` escribe `True` al registro de reset configurado vía FC05.
- El PLC es responsable de regresar el coil a `False`.
- El endpoint devuelve `{"success": bool}` y el frontend muestra feedback inmediato.

### Modbus word swap (client.py)
- `MODBUS_WORD_SWAP=false` (defecto): Float32 orden ABCD — `struct.pack(">HH", w0, w1)`.
- `MODBUS_WORD_SWAP=true`: Float32 orden CDAB — palabras intercambiadas antes de empaquetar.
- Aplica a `read_float32` y `write_float32`.

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
| Alarmas | `/alarms` | Tabla con ACK, filtros; botón Silenciar; panel Registros Modbus configurable |

**Indicador de conexión**: dos indicadores en la navbar — WebSocket (servidor) y Modbus (PLC).  
**AlarmBanner**: botón Silenciar con feedback visual; click derecho también dispara el reset.  
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
- **Alarma de Sobrellenado** — checkbox para activar override; campo altura en **mm**; botón **"Guardar y enviar al PLC"** (naranja) guarda en BD y escribe al `overflow_register` vía FC16 en un solo paso.
- **Registros Modbus — Lectura** — height, overflow, switch registers.
- **Rango del Sensor de Nivel** — min/max en **mm** + registros holding; botón **"Guardar y enviar al PLC"** (ámbar) guarda en BD y escribe vía FC16 en un solo paso.
- **Tabla de Aforo** — visor/editor con filtro, edición inline, agregar/eliminar filas; carga CSV completa.
- **Historial de cambios** — últimas 20 entradas del audit log.

> **Nota UI:** los valores de altura se muestran y editan siempre en **mm** en los formularios de configuración. La BD almacena en metros. La conversión ×1000 / ÷1000 se aplica al cargar y al guardar.

### Identidad visual

- **Favicon:** `/public/favicon.svg` — símbolo B de Brenntag con gradiente púrpura→azul.
- **Logo navbar:** logotipo completo Brenntag inline SVG; texto en blanco para visibilidad sobre fondo oscuro.
- **Splash screen:** logo Brenntag a 48 px con opción de entrar en pantalla completa.

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
- **Fase 9** ✅ Integración PLC real: FC03 holding registers, conversión mm↔m, seed con registros reales, UI configuración en mm
- **Fase 10** ✅ Mejoras operativas: indicador WS+PLC dual, MODBUS_WORD_SWAP, reset alarma con feedback, botones "Guardar y enviar al PLC" unificados, logo Brenntag + favicon
- **Fase 11** ✅ Alarmas de sistema: Alarma DPS y Monitor de Fase como alarmas independientes (tank_id=0); banner y tabla con nombres y colores diferenciados; recuperación al arranque

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

# Leer configuración de registros de alarma global
curl http://localhost:8000/api/alarms/config

# Actualizar registros de alarma global
curl -X PUT http://localhost:8000/api/alarms/config \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"alarm1_register": 6051, "alarm2_register": 6052, "reset_register": 6053}'

# Conectar WebSocket manualmente
wscat -c ws://localhost:8000/ws/live
```
