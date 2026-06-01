import logging
from datetime import datetime, timezone
from typing import Dict

from bson import ObjectId

logger = logging.getLogger(__name__)

# Registro en memoria de las alarmas activas: tank_id -> ObjectId del registro en Mongo
_active_alarms: Dict[int, ObjectId] = {}


async def initialize(db) -> None:
    """Carga alarmas activas desde MongoDB al arrancar para no perder el estado."""
    _active_alarms.clear()
    async for doc in db.alarms.find({"active": True}):
        _active_alarms[doc["tank_id"]] = doc["_id"]
    if _active_alarms:
        logger.warning("Alarmas activas recuperadas al arrancar: %s", list(_active_alarms.keys()))


async def check_alarms(
    tank_id: int,
    height: float,
    overflow_limit: float,
    switch_active: bool,
    db,
) -> None:
    alarm_triggered = (height > overflow_limit) or switch_active

    if alarm_triggered and tank_id not in _active_alarms:
        origin = "height" if height > overflow_limit else "switch"
        result = await db.alarms.insert_one({
            "tank_id": tank_id,
            "origin": origin,
            "start_time": datetime.now(timezone.utc),
            "ack_time": None,
            "end_time": None,
            "active": True,
        })
        _active_alarms[tank_id] = result.inserted_id
        logger.warning("Alarma ACTIVA — TK%d origen=%s", tank_id, origin)

    elif not alarm_triggered and tank_id in _active_alarms:
        alarm_id = _active_alarms.pop(tank_id)
        await db.alarms.update_one(
            {"_id": alarm_id},
            {"$set": {"end_time": datetime.now(timezone.utc), "active": False}},
        )
        logger.info("Alarma FINALIZADA — TK%d", tank_id)


async def ack_alarm(alarm_id: str, db) -> bool:
    """Marca una alarma como reconocida (ACK). Retorna False si ya estaba reconocida."""
    result = await db.alarms.update_one(
        {"_id": ObjectId(alarm_id), "ack_time": None},
        {"$set": {"ack_time": datetime.now(timezone.utc)}},
    )
    return result.modified_count == 1


async def reset_alarm(db) -> bool:
    """Envía True al registro de reset configurado en DB vía Modbus FC05."""
    from ..modbus.client import modbus_client
    cfg = await db.alarm_config.find_one({}, {"_id": 0})
    register = cfg["reset_register"] if cfg else 6053
    return await modbus_client.write_coil(register, True)
