from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import settings

_client: AsyncIOMotorClient = None
_db: AsyncIOMotorDatabase = None


async def connect_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _db = _client[settings.mongodb_db]
    await _db.tanks_config.create_index("tank_id", unique=True)
    await _db.history.create_index([("tank_id", 1), ("timestamp", -1)])
    await _db.alarms.create_index([("tank_id", 1), ("start_time", -1)])
    await _db.alarms.create_index("active")
    await _db.audit_log.create_index([("tank_id", 1), ("timestamp", -1)])
    await _seed_tanks()
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
    """Insert default config for all 13 tanks if collection is empty."""
    if await _db.tanks_config.count_documents({}) > 0:
        return

    tanks = []
    for i in range(1, 14):
        tanks.append({
            "tank_id": i,
            "name": f"TK{i}",
            "product": "",
            "density": 1.0,
            "diameter": 5.0,
            "max_height": 8.0,
            "modbus": {
                # Altura: Float32, 2 registros consecutivos (FC04)
                "height_register": 10001 + (i - 1) * 2,
                # Sobrellenado: Float32, 2 registros consecutivos (FC04)
                "overflow_register": 10027 + (i - 1) * 2,
                # Suiche de nivel: Bool, 1 registro (FC02)
                "switch_register": 30001 + (i - 1),
            },
        })
    await _db.tanks_config.insert_many(tanks)
