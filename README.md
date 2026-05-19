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
| `MONGODB_URI` | `mongodb://db_scada:27017` | Cadena de conexión MongoDB |
| `POLLING_INTERVAL` | `1.0` | Segundos entre lecturas Modbus |

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
│       ├── core/               # Config (Pydantic Settings) + conexión MongoDB
│       ├── modbus/             # Cliente Modbus TCP (real y mock)
│       ├── models/             # Modelos Pydantic: tanques, alarmas, histórico
│       ├── routers/            # Endpoints REST + WebSocket
│       └── services/          # Calculadora, servicio de alarmas, datalogger
└── frontend/
    └── src/
        ├── pages/              # Vista general, detalle, configuración, histórico, alarmas
        ├── components/         # AlarmBanner, TankIcon, LevelBar
        ├── context/            # TankDataContext (estado global WebSocket)
        └── hooks/              # useWebSocket (reconexión automática)
```

## Mapa de registros Modbus

| Variable | Registros | Tipo | FC |
|----------|-----------|------|----|
| Altura TK1–TK13 | 10001–10026 | Float32 ABCD | FC04 |
| Sobrellenado TK1–TK13 | 10027–10052 | Float32 ABCD | FC04 |
| Switch nivel TK1–TK13 | 30001–30013 | Bool | FC02 |
| Alarma 1 / Alarma 2 | 30014–30015 | Bool | FC02 |
| Reset alarma | 30016 | Bool | FC05 (escritura) |

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
