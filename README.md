# Web-SCADA — Monitoreo de Tanques Industriales

Sistema de monitoreo en tiempo real para **13 tanques cilíndricos** mediante Modbus TCP. Adquiere datos del PLC, calcula variables de ingeniería, registra históricos en MongoDB y expone una interfaz web reactiva.

**Stack:** FastAPI · PyModbus · MongoDB · React · TypeScript · Tailwind CSS · Docker Compose

---

## Requisitos previos

| Herramienta | Versión mínima |
|-------------|---------------|
| Docker | 24.x |
| Docker Compose | v2.x (plugin integrado) |
| Git | cualquiera |

No se necesita Python ni Node instalados localmente; todo corre dentro de contenedores.

---

## Instalación — Desarrollo

### 1. Clonar el repositorio

```bash
git clone https://github.com/jdrendon403/brenntag-tanks-scada.git
cd brenntag-tanks-scada/tanks-scada
```

### 2. Configurar variables de entorno

Crear un archivo `.env` en `tanks-scada/` (sobreescribe los valores de `.env.example`):

```bash
# Linux / Mac
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

Editar `.env` según la conexión real:

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `MOCK_MODBUS` | `true` | `true` = simula el PLC; `false` = conecta al PLC real |
| `PLC_HOST` | `192.168.1.100` | IP del PLC Modbus TCP |
| `PLC_PORT` | `502` | Puerto Modbus TCP |
| `MODBUS_WORD_SWAP` | `false` | `true` = invierte palabras Float32 (CDAB en vez de ABCD) |
| `MONGODB_URI` | `mongodb://db_scada:27017` | Cadena de conexión MongoDB |
| `POLLING_INTERVAL` | `1.0` | Segundos entre lecturas Modbus |
| `AUTH_USER` | `admin` | Usuario para acceso a escritura |
| `AUTH_PASSWORD` | `scada1234` | Contraseña (**cambiar en producción**) |
| `AUTH_SECRET` | `cambia-este-secreto` | Clave secreta JWT (**cambiar en producción**) |

### 3. Levantar los servicios

```bash
docker compose up -d
```

### 4. Verificar que todo esté corriendo

```bash
docker compose ps
```

| URL | Descripción |
|-----|-------------|
| http://localhost:5173 | Interfaz web (React) |
| http://localhost:8000/api/ | API REST |
| http://localhost:8000/docs | Documentación Swagger |
| ws://localhost:8000/ws/live | WebSocket tiempo real |

### Comandos útiles en desarrollo

```bash
# Ver logs en tiempo real
docker compose logs -f app_scada
docker compose logs -f frontend

# Reiniciar solo el backend (aplica cambios sin rebuild)
docker compose restart app_scada

# Rebuild completo
docker compose build --no-cache

# Detener todos los servicios
docker compose down
```

---

## Instalación — Producción

En producción, frontend y API quedan en un solo puerto HTTP (Nginx como proxy inverso).

### 1. Crear el archivo de entorno de producción

```bash
# Linux / Mac
cp .env.prod.example .env.prod

# Windows (PowerShell)
copy .env.prod.example .env.prod
```

Editar `.env.prod` y reemplazar los valores marcados:

```dotenv
PLC_HOST=<IP real del PLC>
MOCK_MODBUS=false
MODBUS_WORD_SWAP=false
MONGO_USER=admin
MONGO_PASSWORD=<contraseña segura>
MONGODB_URI=mongodb://admin:<contraseña>@db_scada:27017/scada_tanks?authSource=admin
HTTP_PORT=80
```

> **Importante:** nunca subas `.env.prod` al repositorio; ya está en `.gitignore`.

### 2. Construir y levantar

```bash
# Con Makefile
make prod-build

# Sin Makefile
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 3. Acceder

La aplicación queda disponible en `http://<ip-del-servidor>:80`

```bash
# Ver logs de producción
make logs-prod

# Detener
make down-prod
```

---

## Arquitectura

```
tanks-scada/
├── docker-compose.yml          # Desarrollo: backend + frontend (hot-reload) + MongoDB
├── docker-compose.prod.yml     # Producción: backend + nginx + MongoDB
├── backend/
│   └── app/
│       ├── main.py             # FastAPI lifespan + routers
│       ├── core/               # Config, MongoDB, security (JWT)
│       ├── modbus/             # Cliente Modbus TCP (real y mock)
│       ├── models/             # Modelos Pydantic: tanques, alarmas, histórico
│       ├── routers/            # Endpoints REST + WebSocket + auth
│       ├── services/           # Calculadora, servicio de alarmas, datalogger
│       └── data/calibration/   # Tablas de aforo SGS en JSON (tank_N.json)
└── frontend/
    ├── public/
    │   └── favicon.svg         # Favicon — solo el símbolo B de Brenntag
    └── src/
        ├── pages/              # Vista general, detalle, configuración, histórico, alarmas
        ├── components/         # AlarmBanner, TankIcon, LevelBar, LoginModal
        ├── context/            # TankDataContext + UnitContext + AuthContext
        ├── utils/              # units.ts — conversión y formateo de unidades
        └── hooks/              # useWebSocket (reconexión automática)
```

## Mapa de registros Modbus

| Variable | Registros | Tipo | FC | Notas |
|----------|-----------|------|----|-------|
| Altura TK1–TK13 | 10001–10026 | Float32 | **FC03** | 2 registros por tanque; valor en **mm** |
| Sobrellenado TK1–TK13 | 10301–10326 | Float32 | **FC03** | 2 registros por tanque; valor en **mm** |
| Switch nivel TK1–TK13 | 6001–6013 | Bool | **FC01** | dirección = registro − 1 |
| Sensor mín. TK1–TK13 | 10101–10126 | Float32 | FC03 / FC16 | Lectura FC03; escritura FC16; valor en **mm** |
| Sensor máx. TK1–TK13 | 10201–10226 | Float32 | FC03 / FC16 | Lectura FC03; escritura FC16; valor en **mm** |
| Alarma DPS | configurable | Bool | FC01 | Por defecto reg 6051; genera registro en BD cuando es True |
| Alarma Monitor de Fase | configurable | Bool | FC01 | Por defecto reg 6052; genera registro en BD cuando es True |
| Reset alarma | configurable | Bool | FC05 | Por defecto reg 6053; solo envía True, el PLC resetea |

> El PLC envía todas las alturas en **milímetros**. El backend convierte a metros internamente. Los registros de configuración (overflow, sensor range) se escriben al PLC también en mm.
>
> El orden de palabras Float32 (ABCD o CDAB) se controla con `MODBUS_WORD_SWAP`.

Los registros de alarma global son configurables desde la pantalla **Alarmas → Registros Modbus**.

### Alarmas de sistema

Cuando el coil **Alarma DPS** (reg. 6051) o **Alarma Monitor de Fase** (reg. 6052) pasa a `True`, el backend crea un registro de alarma con `tank_id=0` en la colección `alarms`. Aparece en el banner de alarma global y en la tabla de alarmas bajo la columna **Sistema**, con origen diferenciado por color. Al volver a `False` la alarma se cierra automáticamente.

---

## Autenticación

Las operaciones de **escritura** (configuración, calibración, ACK de alarmas, escritura al PLC) requieren autenticación. Las lecturas y el WebSocket son públicos.

Al intentar cualquier acción protegida sin sesión activa, aparece automáticamente un modal de login. Tras autenticarse, el token se almacena en `sessionStorage` y se adjunta a todas las peticiones (`Authorization: Bearer <token>`). Cerrar la pestaña equivale a cerrar sesión.

```bash
# Obtener token manualmente
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "scada1234"}'

# Usar token en peticiones protegidas
curl -X PUT http://localhost:8000/api/config/tanks/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"product": "Aceite"}'
```

> En producción cambiar `AUTH_PASSWORD` y `AUTH_SECRET` en `.env`.

---

## Tablas de aforo (calibración SGS)

El volumen se calcula por **interpolación lineal** desde tablas de aforo certificadas (SGS), en lugar de la fórmula cilíndrica. Cada tanque puede tener su tabla en `backend/app/data/calibration/tank_N.json`.

### Cargar una tabla desde CSV

```bash
# El CSV debe tener columnas: height_mm, volume_l (alturas ascendentes)
curl -X POST http://localhost:8000/api/config/tanks/1/calibration \
  -F "file=@tabla_tk1.csv"
```

Formato del CSV:

```
height_mm,volume_l
0,417.57
210,1099.40
260,2042.72
...
```

Sin tabla cargada, el sistema usa la fórmula cilíndrica como fallback.

---

## Indicador de conexión

La barra de navegación muestra dos indicadores independientes:

| Estado | Indicador |
|--------|-----------|
| WebSocket caído | 🔴 **Sin conexión** |
| WS activo + PLC conectado | 🟢 **En línea** · 🟢 **PLC** |
| WS activo + PLC sin señal | 🟢 **En línea** · 🟠 **PLC sin señal** |

El estado Modbus se transmite en cada mensaje WebSocket (`modbus_connected`), sin polling adicional.

---

## Probar una alarma manualmente

```bash
# Bajar umbral de alarma del tanque 3 a 1.5 m
curl -X PUT http://localhost:8000/api/config/tanks/3 \
  -H "Content-Type: application/json" \
  -d '{"alarm_height": 1.5}'

# Restaurar (usar valor del PLC)
curl -X PUT http://localhost:8000/api/config/tanks/3 \
  -H "Content-Type: application/json" \
  -d '{"alarm_height": null}'
```
