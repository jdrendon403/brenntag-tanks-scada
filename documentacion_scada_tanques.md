# Documentación Técnica: Sistema Web-SCADA para Monitoreo de Tanques

## 1. Resumen del Proyecto

Desarrollo de una aplicación web industrial tipo SCADA para el monitoreo en tiempo real de 13 tanques cilíndricos de gran capacidad. El sistema se comunica mediante el protocolo **Modbus TCP** con un PLC, almacena datos en **MongoDB** y utiliza **FastAPI** como motor de backend, todo orquestado bajo **Docker**.

## 2. Stack Tecnológico

- **Lenguaje:** Python 3.10+
- **Framework Web:** FastAPI
- **Base de Datos:** MongoDB (para configuración, históricos de un mes y logs de alarmas/auditoría).
- **Comunicación Industrial:** Modbus TCP (Librería `pymodbus`).
- **Visualización:** Frontend con React y con WebSockets para actualización en tiempo real.
- **Despliegue:** Docker y Docker Compose.

## 3. Configuración de Comunicación (Modbus TCP)

El sistema actúa como cliente Modbus TCP. La dirección IP del PLC y el puerto son configurables mediante variables de entorno.

### Tabla de Registros Modbus

> Todos los valores de altura que el PLC envía o recibe están en **milímetros**. El backend convierte a metros para uso interno.

| Variable | Registros | Tipo | FC | Descripción |
|----------|-----------|------|----|-------------|
| Altura TK1–TK13 | 10001–10026 | Float32 | **FC03** | Nivel actual en **mm** (2 regs por tanque) |
| Sobrellenado TK1–TK13 | 10301–10326 | Float32 | **FC03** | Límite de sobrellenado en **mm** (2 regs por tanque) |
| Sensor mín. TK1–TK13 | 10101–10126 | Float32 | FC03 / FC16 | Rango mínimo del sensor en **mm** |
| Sensor máx. TK1–TK13 | 10201–10226 | Float32 | FC03 / FC16 | Rango máximo del sensor en **mm** |
| SWTk1–SWTk13 | 6001–6013 | Bool | **FC01** | Suiche de nivel físico; dirección = registro − 1 |
| Alarma DPS | configurable (def. 6051) | Bool | FC01 | Alarma DPS; genera registro de alarma de sistema al activarse |
| Alarma Monitor de Fase | configurable (def. 6052) | Bool | FC01 | Alarma Monitor de Fase; genera registro de alarma de sistema al activarse |
| Reset Alarma | configurable (def. 6053) | Bool | FC05 | Escritura True para silenciar; el PLC resetea a False |

> Los registros de alarma global son configurables desde la pantalla **Alarmas → Registros Modbus** sin necesidad de reiniciar el sistema.

### Orden de palabras Float32

El sistema soporta dos órdenes de bytes para valores Float32:

- **ABCD** (por defecto, `MODBUS_WORD_SWAP=false`): palabra alta primero.
- **CDAB** (`MODBUS_WORD_SWAP=true`): palabras invertidas para PLCs que usen este orden.

Esta configuración aplica tanto a lecturas (FC03) como a escrituras (FC16).

## 4. Pantallas de la Aplicación

### 4.1 Pantalla General (Vista Aérea)

- Representación gráfica de los 13 tanques.
- Datos por tanque: Nombre del producto, Porcentaje (%), Altura de nivel, Peso y Volumen.
- **Animación de Alarma:** Si un tanque entra en estado de alarma, su icono titila en rojo.

### 4.2 Pantalla de Detalle de Tanque

- Visualización vertical del nivel, peso y volumen mediante barras de progreso.
- Gráfico histórico: Tendencia del último mes con intervalos de 1 minuto.
- Información adicional: Número de tanque, nombre del producto y densidad.
- Acceso directo al botón de configuración del tanque.

### 4.3 Pantalla de Configuración

Permite la edición de parámetros críticos. Cada cambio se registra en una tabla de auditoría con fecha y hora.

- **Unidades de visualización** — mm / cm / m para altura; L / gal US para volumen. Persistidas en `localStorage`.
- **Producto** — Nombre del tanque y producto almacenado.
- **Densidad** — kg/L para cálculo de peso.
- **Alarma de Sobrellenado** — Checkbox para activar override; altura en mm. Botón **"Guardar y enviar al PLC"** guarda en BD y escribe al registro `overflow_register` vía FC16 en un solo paso.
- **Registros Modbus — Lectura** — Registros de altura, sobrellenado y suiche.
- **Rango del Sensor de Nivel** — Valores mín/máx en mm + registros holding. Botón **"Guardar y enviar al PLC"** guarda en BD y escribe vía FC16 en un solo paso.
- **Tabla de Aforo** — Visor/editor con filtro, edición inline, agregar/eliminar filas; carga CSV completa.
- **Historial de cambios** — Últimas 20 entradas del audit log.

### 4.4 Pantalla de Consulta Histórica

- Filtros por variable y rango de fechas.
- Visualización de datos almacenados cada 60 segundos.

### 4.5 Pantalla de Alarmas

- Tabla en orden descendente (más reciente arriba).
- Campos: Tanque, Origen, Inicio, Reconocimiento (ACK), Finalización.
- Columna **Tanque**: muestra `TK1`–`TK13` para alarmas de nivel, o **Sistema** para alarmas DPS y Monitor de Fase.
- Columna **Origen**: `Altura` (naranja), `Suiche` (morado), `Alarma DPS` (azul), `Monitor de Fase` (teal).
- Panel colapsable **Registros Modbus** para configurar los registros de Alarma DPS, Alarma Monitor de Fase y Reset desde la interfaz.
- Botón **Silenciar (Reset PLC)** con feedback visual: `Enviando…` → `✓ Reset enviado` / `✗ Error al resetear`.

## 5. Indicador de Conexión

La barra de navegación muestra dos indicadores independientes en tiempo real:

| Estado | Indicador |
|--------|-----------|
| WebSocket caído | 🔴 pulsante **Sin conexión** |
| WS activo + Modbus conectado | 🟢 **En línea** · 🟢 **PLC** |
| WS activo + Modbus sin señal | 🟢 **En línea** · 🟠 pulsante **PLC sin señal** |

El estado Modbus (`modbus_connected`) se incluye en cada mensaje WebSocket, sin polling adicional al backend.

## 6. Lógica de Negocio y Control

### Cálculos Automáticos

Con tabla de aforo cargada (interpolación lineal):
- **Volumen (L):** interpolación sobre tabla `height_mm → volume_l`.
- **Porcentaje:** `(volumen / volumen_máximo_tabla) × 100`.
- **Peso (kg):** `volumen × densidad`.

Sin tabla (fallback fórmula cilíndrica):
- **Volumen (L):** `π × (diámetro/2)² × altura_m × 1000`.
- **Porcentaje:** `(altura / max_height) × 100`.

### Gestión de Alarmas y Datalogger

1. **Datalogger:** Almacenamiento cada 60 segundos de: Nivel, Porcentaje, Peso, Volumen y Estado del suiche.
2. **Detección de alarma por tanque:** Se dispara si `Altura > Límite Sobrellenado` O `Suiche == True`. Registro en BD con `tank_id` = 1–13.
3. **Alarmas de sistema:** Cuando los coils **Alarma DPS** (reg. 6051) o **Alarma Monitor de Fase** (reg. 6052) están en `True`, se crea un registro de alarma con `tank_id=0` en la colección `alarms`. Se resuelve automáticamente cuando el coil vuelve a `False`.
4. **Notificación Global:** Banner de alarma persistente en todas las pantallas muestra los nombres de todos los tanques y sistemas en alarma. Con botón **Silenciar**.
5. **Silenciamiento:** Escribe `True` al registro de reset configurado (FC05). El PLC se encarga de volver a `False`.
6. **Reconocimiento (ACK):** Marca la alarma en BD sin afectar el estado del PLC.
7. **Recuperación al arranque:** Las alarmas activas en MongoDB (incluyendo alarmas de sistema) se recuperan al reiniciar el servicio.

### Reset de Alarma

El botón **Silenciar** (banner o pantalla Alarmas):
1. Envía `True` al coil de reset configurado vía FC05.
2. Muestra feedback inmediato: `Enviando…` → `✓ Reset enviado` o `✗ Error`.
3. El PLC es responsable de regresar el coil a `False`.

## 7. Arquitectura Docker

El proyecto se despliega mediante tres contenedores:

1. `app_scada`: FastAPI + PyModbus + lógica de negocio.
2. `db_scada`: MongoDB para persistencia.
3. `frontend` (dev) / `proxy_web` (prod): Vite dev server o Nginx sirviendo la SPA.

## 8. Identidad Visual

- **Favicon:** Símbolo B de Brenntag con gradiente púrpura→azul (`public/favicon.svg`).
- **Logo en navbar:** Logotipo completo Brenntag en blanco, visible sobre fondo oscuro.
- **Splash screen:** Logo Brenntag grande al iniciar, con opción de entrar en pantalla completa.
