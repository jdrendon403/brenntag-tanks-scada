```python
readme_content = """# Web-SCADA para Monitoreo de Tanques Industriales

Este proyecto es una aplicación web tipo SCADA diseñada para el monitoreo en tiempo real de **13 tanques cilíndricos de gran capacidad**. El sistema adquiere datos de un PLC a través del protocolo **Modbus TCP**, procesa las variables de ingeniería, almacena históricos en **MongoDB**, y expone una API robusta y asíncrona mediante **FastAPI**, todo empaquetado y listo para desplegarse con **Docker**.

## 🚀 Características Principales

1. **Monitoreo en Tiempo Real (Modbus TCP):** Adquisición continua de variables críticas de 13 tanques desde el PLC de manera asíncrona.
2. **Dirección IP del PLC Dinámica:** Configuración de la IP y puerto del PLC directamente desde la interfaz web, sin necesidad de reiniciar contenedores ni modificar variables de entorno.
3. **Datalogger Automático:** Registro de variables de nivel, porcentaje, peso, volumen y estado del suiche de sobrellenado cada 60 segundos de forma automatizada.
4. **Cálculos de Ingeniería Automáticos:** Cálculo en tiempo real de volumen, peso y porcentaje de llenado basado en las dimensiones internas del tanque (diámetro y altura) y la densidad del producto.
5. **Sistema de Alertas y Banner Global:** Activación de alarmas visuales si el nivel supera el límite configurado o si el suiche físico de nivel se activa. Incluye un mecanismo para silenciar/resetear alarmas escribiendo directamente al PLC.
6. **Trazabilidad y Auditoría:** Registro obligatorio con fecha y hora de cualquier cambio realizado en la configuración de los tanques o del PLC.

---

## 🛠️ Arquitectura y Tecnologías

El sistema está construido sobre un stack moderno, escalable y de baja latencia:

* **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) - Framework asíncrono de alto rendimiento.
* **Driver Modbus:** [PyModbus](https://github.com/pymodbus-dev/pymodbus) - Cliente Modbus TCP asíncrono para la comunicación industrial.
* **Base de Datos:** [MongoDB](https://www.mongodb.com/) - Base de datos NoSQL ideal para series temporales (Datalogger) y configuraciones flexibles.
* **Driver de Base de Datos:** [Motor](https://motor.readthedocs.io/) - Driver asíncrono de MongoDB para Python.
* **Despliegue:** [Docker](https://www.docker.com/) & **Docker Compose** - Orquestación de contenedores para un despliegue rápido y consistente en entornos locales o de producción (Edge/On-Premise).

---

## 📁 Estructura del Proyecto

```text
scada-tank-project/
│
├── docker-compose.yml         # Orquestación de contenedores (App + MongoDB)
├── README.md                  # Documentación principal del proyecto
│
├── /backend                   # Código fuente del backend (FastAPI)
│   ├── Dockerfile             # Receta de construcción del contenedor backend
│   ├── requirements.txt       # Dependencias de Python (FastAPI, pymodbus, motor, etc.)
│   ├── main.py                # Punto de entrada de la aplicación y tareas en segundo plano
│   ├── database.py            # Inicialización y conexiones de MongoDB
│   ├── modbus_manager.py      # Lógica de comunicación cliente Modbus TCP e ingeniería
│   ├── schemas.py             # Modelos de validación de datos (Pydantic)
│   └── /routes                # Controladores de la API (Tanques, PLC, Alarmas, Históricos)

```

---

## ⚙️ Requisitos Previos

Antes de levantar el proyecto, asegúrate de tener instalado en tu servidor o máquina de desarrollo:

* **Docker** (versión 20.10 o superior)
* **Docker Compose** (versión 1.29 o superior)

---

## 📦 Instalación y Despliegue

Sigue estos pasos para poner en marcha el sistema SCADA:

1. Clona el repositorio en tu servidor o máquina local:
```bash
git clone [https://github.com/tu-usuario/scada-tank-project.git](https://github.com/tu-usuario/scada-tank-project.git)
cd scada-tank-project

```


2. Construye y levanta los servicios en segundo plano usando Docker Compose:
```bash
docker-compose up -d --build

```


3. Verifica que los contenedores estén corriendo correctamente:
```bash
docker-compose ps

```


4. La API de FastAPI estará disponible en: [http://localhost:8000](https://www.google.com/search?q=http://localhost:8000)
* Puedes acceder a la documentación interactiva de la API (Swagger UI) en: [http://localhost:8000/docs](https://www.google.com/search?q=http://localhost:8000/docs)



---

## 🗺️ Mapa de Registros Modbus (Referencia)

El backend lee y escribe de manera transparente en las siguientes direcciones de memoria del PLC:

| Variable | Registro Inicial | Tipo de Dato | Función Modbus |
| --- | --- | --- | --- |
| **Altura TK1 a TK13** | `10001` a `10025` | Real (Float32) | Read Holding Registers (03) |
| **Sobrellenado TK1 a TK13** | `10027` a `10051` | Real (Float32) | Read Holding Registers (03) |
| **Switch de Nivel TK1 a TK13** | `3001` a `30013` | Booleano | Read Coils (01) / Discrete Inputs (02) |
| **Alarma General 1 y 2** | `30014`, `30015` | Booleano | Read Coils (01) / Discrete Inputs (02) |
| **Reset Alarma (Silenciar)** | `30016` | Booleano | **Write Single Coil (05)** |

*Nota: Los tipos de datos `Real` ocupan dos registros consecutivos de 16 bits (32 bits en total) y se decodifican bajo el estándar IEEE 754.*

---

## 📝 Configuración Inicial Obligatoria

Al iniciar la aplicación por primera vez, es necesario parametrizar las dimensiones y los registros de los 13 tanques a través de la pantalla de configuración (o mediante los endpoints de la API).

Un ejemplo de la carga de configuración de un tanque (`/config/tank`):

```json
{
  "id": 1,
  "nombre_producto": "Gasolina Corriente",
  "diametro_interno": 4.50,
  "altura_maxima": 12.00,
  "densidad": 0.74,
  "altura_alarma": 11.50,
  "reg_altura": 10001,
  "reg_sobrellenado": 10027,
  "reg_suiche": 3001
}

```

---

## 🕒 Lógica del Datalogger y Almacenamiento

* **Intervalo:** Cada 60 segundos, una tarea asíncrona (`Background Task`) realiza un barrido por los 13 tanques.
* **Colección de Destino:** `historical_logs` en MongoDB.
* **Estructura de Almacenamiento:** Cada registro guarda de forma atómica: `tank_id`, `timestamp`, `altura`, `porcentaje`, `volumen`, `peso` y `suiche_activo`. Esto asegura indexaciones rápidas para la pantalla de consultas históricas y generación de gráficas de tendencias del último mes.
"""

with open("README.md", "w", encoding="utf-8") as f:
f.write(readme_content)

```
El archivo `README.md` ha sido generado de manera exitosa para tu proyecto. Este archivo contiene la documentación introductoria limpia, estructurada y en español que servirá como guía de instalación, arquitectura y referencia del mapa de registros Modbus tanto para ti como para cualquier desarrollador (o IA) que continúe con el proyecto.

Tu archivo README.md está listo
[file-tag: code-generated-file-0-1779142504207759968]

Con el `README.md` y la base documental listos, ¿cuál sería el siguiente paso en el que te gustaría trabajar? Podemos avanzar en el desarrollo de los componentes visuales del frontend en React/Vue, o pulir la gestión de las alarmas en el backend.

```