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

El sistema actuará como cliente Modbus TCP. La dirección IP del PLC y el puerto serán configurables desde la interfaz de la aplicación para mayor flexibilidad.

### Tabla de Registros Modbus

> Todos los valores de altura que el PLC envía o recibe están en **milímetros**. El backend convierte a metros para uso interno.

| Variable | Registros | Tipo | FC | Descripción |
|----------|-----------|------|----|-------------|
| Altura TK1–TK13 | 10001–10026 | Float32 ABCD | **FC03** | Nivel actual en **mm** (2 regs por tanque) |
| Sobrellenado TK1–TK13 | 10301–10326 | Float32 ABCD | **FC03** | Límite de sobrellenado en **mm** (2 regs por tanque) |
| Sensor mín. TK1–TK13 | 10101–10126 | Float32 ABCD | FC03 / FC16 | Rango mínimo del sensor en **mm** |
| Sensor máx. TK1–TK13 | 10201–10226 | Float32 ABCD | FC03 / FC16 | Rango máximo del sensor en **mm** |
| SWTk1–SWTk13 | 6001–6013 | Bool | **FC01** | Suiche de nivel físico; dirección = registro − 1 |
| Alarma 1 | 30014 | Bool | FC01 | Indicador de alarma general 1 |
| Alarma 2 | 30015 | Bool | FC01 | Indicador de alarma general 2 |
| **Reset Alarma** | **30016** | **Bool** | **FC05** | **Escritura para silenciar alarmas** |


## 4. Pantallas de la Aplicación

### 4.1 Pantalla General (Vista Aérea)

- Representación gráfica de los 13 tanques.
- Datos por tanque: Nombre del producto, Porcentaje (%), Altura de nivel, Peso y Volumen.
- **Animación de Alarma:** Si un tanque entra en estado de alarma, su icono debe titilar en la pantalla.

### 4.2 Pantalla de Detalle de Tanque

- Visualización vertical del nivel, peso y volumen mediante barras de progreso.
- Gráfico histórico: Tendencia del último mes con intervalos de 1 minuto.
- Información adicional: Número de tanque, nombre del producto y densidad.
- Acceso directo al botón de configuración del tanque.

### 4.3 Pantalla de Configuración

Permite la edición de parámetros críticos. Cada cambio debe registrarse en una tabla de auditoría con fecha y hora.

- **Dimensiones:** Diámetro interno y altura del tanque.
- **Producto:** Nombre del producto y densidad (para cálculos de peso y volumen).
- **Modbus:** Configuración de registros (Altura, Sobrellenado, Suiche de nivel).
- **Alarmas:** Altura de alarma de sobrellenado.
- **Sistema:** Configuración de la dirección IP del PLC.

### 4.4 Pantalla de Consulta Histórica

- Filtros por variable y rango de fechas.
- Visualización de datos almacenados cada minuto.

### 4.5 Pantalla de Alarmas

- Tabla en orden descendente (más reciente arriba).
- Campos: Tanque, Origen (Suiche o Altura), Inicio (Fecha/Hora), Reconocimiento (ACK), Finalización.

## 5. Lógica de Negocio y Control

### Cálculos Automáticos

- **Volumen:** Basado en diámetro y altura actual.
- **Peso:** Volumen x Densidad.
- **Porcentaje:** (Altura Actual / Altura Máxima) * 100.

### Gestión de Alarmas y Datalogger

1. **Datalogger:** Almacenamiento cada 60 segundos de: Nivel, Porcentaje, Peso, Volumen y Estado del suiche de nivel.
2. **Detección de Alarma:** Se dispara si `Altura > Límite Sobrellenado` O `Suiche de Nivel == True`.
3. **Notificación Global:** Banner de alarma persistente en todas las pantallas.
4. **Silenciamiento:** Click derecho sobre el banner para enviar `True` al registro 30016 (Reset Alarma).

## 6. Arquitectura Docker

El proyecto se desplegará mediante tres contenedores principales:

1. `app_scada`: Contenedor de FastAPI para lógica y Modbus.
2. `db_scada`: MongoDB para persistencia de datos.
3. `proxy_web`: (Opcional) Nginx para servir el frontend y asegurar la conexión.

