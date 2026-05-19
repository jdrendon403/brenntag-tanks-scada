import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def datalog_loop() -> None:
    """Guarda un snapshot de todos los tanques en MongoDB cada 60 segundos."""
    while True:
        await asyncio.sleep(60)
        try:
            from ..core.database import get_db
            from ..modbus.poller import tank_states

            db = get_db()
            if not tank_states:
                continue

            records = [
                {
                    "tank_id": s["tank_id"],
                    "timestamp": datetime.now(timezone.utc),
                    "height": s["height"],
                    "percentage": s["percentage"],
                    "weight": s["weight"],
                    "volume": s["volume"],
                    "switch_active": s["switch_active"],
                }
                for s in tank_states.values()
            ]
            await db.history.insert_many(records)
            logger.debug("Datalog: %d registros almacenados", len(records))
        except Exception as exc:
            logger.error("Error en datalog_loop: %s", exc)
