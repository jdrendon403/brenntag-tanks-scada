import json
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

_CALIB_DIR = Path(__file__).parent.parent / "data" / "calibration"


def _load_calibration(tank_id: int) -> list[dict]:
    path = _CALIB_DIR / f"tank_{tank_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8")).get("table", [])
        except Exception:
            return []
    return []

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


async def connect_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
    _db = _client[settings.mongodb_db]
    await _db.tanks_config.create_index("tank_id", unique=True)
    await _db.history.create_index([("tank_id", 1), ("timestamp", -1)])
    await _db.alarms.create_index([("tank_id", 1), ("start_time", -1)])
    await _db.alarms.create_index("active")
    await _db.audit_log.create_index([("tank_id", 1), ("timestamp", -1)])
    await _seed_tanks()
    await _seed_alarm_config()
    # Recuperar alarmas activas en memoria tras arranque
    from ..services.alarm_service import initialize as init_alarms
    await init_alarms(_db)


async def close_db() -> None:
    global _client
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    return _db


async def _seed_tanks() -> None:
    """Inserta config por defecto de los 13 tanques si la colección está vacía.
    Si existen archivos JSON de calibración en app/data/calibration/, se embeben."""
    if await _db.tanks_config.count_documents({}) > 0:
        # Refresh calibration tables from JSON files without touching user config
        for i in range(1, 14):
            table = _load_calibration(i)
            if table:
                await _db.tanks_config.update_one(
                    {"tank_id": i},
                    {"$set": {"calibration_table": table}},
                )
        return

    # Configuración real Brenntag Barranquilla — PLC Modbus FC03, valores en metros
    _DEFAULTS = [
        {"tank_id":  1, "name": "TK1",          "product": "Acido Sulfurico",   "density": 1.84, "diameter": 6.0, "max_height": 10.0},
        {"tank_id":  2, "name": "Aceido Acetico","product": "producto conforme", "density": 0.98, "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  3, "name": "TK3",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  4, "name": "TK4",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  5, "name": "TK5",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  6, "name": "TK6",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  7, "name": "TK7",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  8, "name": "TK8",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id":  9, "name": "TK9",           "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id": 10, "name": "TK10",          "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id": 11, "name": "TK11",          "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id": 12, "name": "TK12",          "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
        {"tank_id": 13, "name": "TK13",          "product": "",                  "density": 1.0,  "diameter": 5.0, "max_height":  8.0},
    ]

    tanks = []
    for d in _DEFAULTS:
        i = d["tank_id"]
        tanks.append({
            **d,
            "alarm_height": 9.0,
            "calibration_table": _load_calibration(i),
            "modbus": {
                "height_register":   10001 + (i - 1) * 2,   # FC03 holding, Float32
                "overflow_register": 10301 + (i - 1) * 2,   # FC03 holding, Float32
                "switch_register":    6001 + (i - 1),        # FC01 coil, Bool
            },
            "sensor_range": {
                "min_value":    0.0,
                "max_value":   10.0,
                "min_register": 10101 + (i - 1) * 2,
                "max_register": 10201 + (i - 1) * 2,
            },
        })
    await _db.tanks_config.insert_many(tanks)


async def _seed_alarm_config() -> None:
    """Inserta configuración de registros de alarma global si no existe."""
    if await _db.alarm_config.count_documents({}) == 0:
        await _db.alarm_config.insert_one({
            "alarm1_register": 6051,   # FC01 coil — Alarma general 1
            "alarm2_register": 6052,   # FC01 coil — Alarma general 2
            "reset_register":  6053,   # FC05 coil — Reset alarma
        })
