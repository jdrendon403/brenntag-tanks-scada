# Plan de Desarrollo: Sistema Web-SCADA Monitoreo de Tanques

## Contexto

Se requiere desarrollar una aplicación web industrial tipo SCADA para monitorear en tiempo real 13 tanques cilíndricos en la planta de Brenntag Barranquilla. El sistema debe comunicarse vía Modbus TCP con un PLC, persistir datos históricos en MongoDB, exponer una API REST/WebSocket con FastAPI, y presentar una interfaz React. Todo debe correr en Docker Compose.

El plan prioriza que el backend sea funcional antes del frontend, y que la integración Modbus sea simulable (modo mock) para desarrollo sin PLC físico.

---

## Estructura del Proyecto

```
tanks-scada/
├── backend/
│   ├── app/
│   │   ├── main.py                  # Punto de entrada FastAPI
│   │   ├── core/
│   │   │   ├── config.py            # Settings (IP PLC, MongoDB URI, etc.)
│   │   │   └── database.py          # Conexión MongoDB (Motor async)
│   │   ├── modbus/
│   │   │   ├── client.py            # Cliente Modbus TCP (pymodbus async)
│   │   │   └── poller.py            # Loop de lectura periódica (cada ~1s)
│   │   ├── models/
│   │   │   ├── tank.py              # Modelo Pydantic/Mongo para tanque
│   │   │   ├── alarm.py             # Modelo de alarma
│   │   │   └── history.py           # Modelo de registro histórico
│   │   ├── routers/
│   │   │   ├── tanks.py             # GET /tanks, GET /tanks/{id}
│   │   │   ├── config.py            # GET/PUT /config/tanks/{id}, /config/plc
│   │   │   ├── alarms.py            # GET /alarms, POST /alarms/reset
│   │   │   ├── history.py           # GET /history?tank=&from=&to=
│   │   │   └── websocket.py         # WS /ws/live
│   │   └── services/
│   │       ├── calculator.py        # Volumen, peso, porcentaje
│   │       ├── alarm_service.py     # Detección y gestión de alarmas
│   │       └── datalogger.py        # Escritura en MongoDB cada 60s
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── GeneralView.tsx      # Vista aérea con 13 tanques
│   │   │   ├── TankDetail.tsx       # Detalle individual
│   │   │   ├── Configuration.tsx    # Edición de parámetros
│   │   │   ├── History.tsx          # Consulta histórica con filtros
│   │   │   └── Alarms.tsx           # Tabla de alarmas
│   │   ├── components/
│   │   │   ├── TankIcon.tsx         # Icono con animación de alarma (titilado)
│   │   │   ├── AlarmBanner.tsx      # Banner global persistente
│   │   │   ├── LevelBar.tsx         # Barra de progreso vertical
│   │   │   └── HistoryChart.tsx     # Gráfico de tendencia (recharts/chart.js)
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts      # Hook para suscripción WS
│   │   └── api/
│   │       └── client.ts            # Axios client con base URL configurable
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── .env.example
```

---

## Fases de Implementación

### Fase 1 — Backend Core (Semana 1)

**Objetivo:** API funcional con datos simulados.

1. **Scaffolding:** Crear proyecto FastAPI con estructura de carpetas.
2. **Configuración:** `config.py` con Pydantic Settings — IP PLC, puerto Modbus, URI MongoDB, intervalo de polling.
3. **Modelos MongoDB:**
   - `TankConfig`: diámetro, altura máxima, producto, densidad, registros Modbus asociados.
   - `AlarmRecord`: tanque, origen (suiche/altura), inicio, ACK, fin.
   - `HistoryRecord`: tanque, timestamp, nivel, porcentaje, peso, volumen, suiche.
4. **Cliente Modbus (`client.py`):** Wrapper async sobre `pymodbus.AsyncModbusTcpClient`. Incluir modo mock para desarrollo.
5. **Poller (`poller.py`):** Tarea `asyncio` que cada 1 segundo lee los registros Modbus y publica al WebSocket manager.
6. **Calculadora (`calculator.py`):**
   - `volumen = π * (diametro/2)² * altura`
   - `peso = volumen * densidad`
   - `porcentaje = (altura / altura_maxima) * 100`
7. **Routers básicos:** `/tanks` y `/tanks/{id}` retornando datos calculados.

### Fase 2 — Alarmas y Datalogger (Semana 2)

**Objetivo:** Lógica de negocio completa.

1. **Alarm Service:**
   - Detectar: `altura > limite_sobrellenado` OR `suiche == True`.
   - Crear registro en MongoDB con timestamp de inicio.
   - Cerrar registro (campo `fin`) cuando la condición desaparece.
   - Reset de alarma: escribir `True` al registro Modbus 30016.
2. **Datalogger:** Tarea `asyncio` que cada 60 segundos guarda snapshot de los 13 tanques en `HistoryRecord`.
3. **Router de alarmas:** `GET /alarms` (paginado, orden descendente), `POST /alarms/reset`.
4. **Router de historial:** `GET /history` con filtros `tank_id`, `from`, `to`.
5. **Auditoría de configuración:** Registrar en MongoDB cada cambio de parámetro con usuario y timestamp.

### Fase 3 — WebSocket y Tiempo Real (Semana 2-3)

**Objetivo:** Actualización en vivo del frontend.

1. **WebSocket Manager:** Clase que mantiene lista de conexiones activas y hace broadcast.
2. **Endpoint WS `/ws/live`:** Emite JSON con estado completo de los 13 tanques cada vez que el poller obtiene nuevos datos.
3. **Formato del mensaje WS:**
```json
{
  "timestamp": "ISO8601",
  "tanks": [{ "id": 1, "nivel": 2.5, "porcentaje": 65.2, "peso": 3200, "volumen": 3000, "alarma": false }]
}
```

### Fase 4 — Frontend React (Semana 3-4)

**Objetivo:** Interfaz completa y conectada.

1. **Setup:** Vite + React + TypeScript + TailwindCSS.
2. **Hook `useWebSocket`:** Conexión persistente con reconexión automática.
3. **AlarmBanner:** Componente global, visible en todas las rutas, click derecho envía reset al backend.
4. **Vista General (`GeneralView`):** Grid de 13 `TankIcon`. Animación CSS `@keyframes` para titilado cuando `alarma == true`.
5. **Vista Detalle (`TankDetail`):** Barras de progreso verticales, gráfico histórico del último mes (intervalo 1 min) con `recharts`.
6. **Configuración (`Configuration`):** Formulario con validación, envía `PUT /config/tanks/{id}`. Tabla de auditoría debajo.
7. **Histórico (`History`):** DatePicker + selector de variable + tabla/gráfico.
8. **Alarmas (`Alarms`):** Tabla paginada con campos: Tanque, Origen, Inicio, ACK, Fin.

### Fase 5 — Docker y Despliegue (Semana 4)

**Objetivo:** Sistema listo para producción.

1. **`Dockerfile` backend:** Imagen `python:3.10-slim`, instala `requirements.txt`, expone puerto 8000.
2. **`Dockerfile` frontend:** Imagen `node:18-alpine` para build, `nginx:alpine` para servir estáticos.
3. **`docker-compose.yml`:**
   - `app_scada`: Backend FastAPI.
   - `db_scada`: MongoDB con volumen persistente.
   - `proxy_web`: Nginx — sirve frontend en `/` y hace proxy de `/api` y `/ws` al backend.
4. **`.env`:** Variables de entorno para IP PLC, credenciales MongoDB, modo mock.
5. **Healthchecks** en Compose para MongoDB y backend.

---

## Mapa de Registros Modbus

| Variable            | Registros     | Tipo    | Notas                          |
|---------------------|---------------|---------|--------------------------------|
| Altura TK1–TK13     | 10001–10025   | Float32 | 2 registros por tanque         |
| Sobrellenado TK1–13 | 10027–10051   | Float32 | 2 registros por tanque         |
| SWTk1–SWTk13        | 30001–30013   | Bool    | 1 registro por tanque          |
| Alarma 1            | 30014         | Bool    | Solo lectura                   |
| Alarma 2            | 30015         | Bool    | Solo lectura                   |
| Reset Alarma        | 30016         | Bool    | Escritura para silenciar       |

---

## Dependencias Principales

**Backend (`requirements.txt`):**
```
fastapi>=0.111
uvicorn[standard]
pymodbus>=3.6
motor
pydantic-settings
websockets
```

**Frontend (`package.json`):**
```
react, react-dom, react-router-dom
typescript, vite
tailwindcss
recharts
axios
```

---

## Verificación

1. **Modbus mock:** Iniciar backend con `MOCK_MODBUS=true`, verificar que `/tanks` retorna datos simulados.
2. **WebSocket:** Conectar con `wscat -c ws://localhost:8000/ws/live`, confirmar mensajes cada segundo.
3. **Datalogger:** Esperar 60s, consultar `GET /history?tank_id=1` y verificar registros en MongoDB.
4. **Alarmas:** Simular `nivel > sobrellenado` en el mock, confirmar que `GET /alarms` muestra la alarma activa y el banner aparece en el frontend.
5. **Reset alarma:** Click derecho en banner → `POST /alarms/reset` → confirmar escritura al registro 30016 (en logs del mock).
6. **Docker Compose:** `docker-compose up --build`, acceder a `http://localhost` y navegar todas las pantallas.
