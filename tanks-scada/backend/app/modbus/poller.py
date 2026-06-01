import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..core.config import settings
from ..core.database import get_db
from ..services.calculator import (
    calculate_percentage, calculate_percentage_volume,
    calculate_volume, calculate_weight, get_max_volume,
)
from .client import modbus_client

logger = logging.getLogger(__name__)

# Estado en memoria de los 13 tanques — compartido con routers y WebSocket
tank_states: Dict[int, Dict[str, Any]] = {}

# Referencia al WebSocketManager; se asigna desde main.py tras crear la app
ws_manager: Optional[Any] = None


async def poll_loop() -> None:
    """Tarea asyncio principal: lee Modbus cada `polling_interval` segundos."""
    from ..services.alarm_service import check_alarms

    while True:
        try:
            await _poll_once()
        except Exception as exc:
            logger.error("Error en poll_loop: %s", exc)
        await asyncio.sleep(settings.polling_interval)


async def _poll_once() -> None:
    from ..services.alarm_service import check_alarms

    db = get_db()
    configs = await db.tanks_config.find().to_list(length=None)

    for cfg in configs:
        tank_id: int = cfg["tank_id"]
        modbus_cfg = cfg["modbus"]

        # PLC envía altura y overflow en mm → convertir a metros
        raw_height = await modbus_client.read_float32(modbus_cfg["height_register"])
        height = (raw_height / 1000.0) if raw_height is not None else 0.0
        # alarm_height en config tiene prioridad sobre el registro Modbus del PLC
        if cfg.get("alarm_height") is not None:
            overflow_limit = float(cfg["alarm_height"])
        else:
            raw_overflow = await modbus_client.read_float32(modbus_cfg["overflow_register"])
            overflow_limit = (raw_overflow / 1000.0) if raw_overflow is not None else cfg["max_height"]
        switch_active = await modbus_client.read_bool(modbus_cfg["switch_register"]) or False

        height = max(0.0, height)
        table = cfg.get("calibration_table") or []
        volume = calculate_volume(cfg["diameter"], height, table or None)
        weight = calculate_weight(volume, cfg["density"])
        if table:
            percentage = calculate_percentage_volume(volume, get_max_volume(table))
        else:
            percentage = calculate_percentage(height, cfg["max_height"])
        alarm = (height > overflow_limit) or switch_active

        tank_states[tank_id] = {
            "tank_id": tank_id,
            "name": cfg.get("name", f"TK{tank_id}"),
            "product": cfg.get("product", ""),
            "height": round(height, 3),
            "percentage": round(percentage, 1),
            "volume": round(volume, 1),
            "weight": round(weight, 1),
            "overflow_limit": round(overflow_limit, 3),
            "switch_active": switch_active,
            "alarm": alarm,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        await check_alarms(tank_id, height, overflow_limit, switch_active, db)

    # Leer alarmas globales del PLC con registros configurables
    alarm_cfg = await db.alarm_config.find_one({}, {"_id": 0})
    if alarm_cfg:
        alarm1 = await modbus_client.read_bool(alarm_cfg["alarm1_register"]) or False
        alarm2 = await modbus_client.read_bool(alarm_cfg["alarm2_register"]) or False
    else:
        alarm1 = alarm2 = False

    if ws_manager and tank_states:
        await ws_manager.broadcast({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tanks": list(tank_states.values()),
            "system_alarms": {"alarm1": alarm1, "alarm2": alarm2},
            "modbus_connected": modbus_client.is_connected,
        })
