from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from ..core.database import get_db
from ..core.security import require_auth
from ..services.alarm_service import ack_alarm, reset_alarm

router = APIRouter(prefix="/api/alarms", tags=["alarms"])


def _serialize(doc: dict) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("/")
async def get_alarms(
    active_only: bool = False,
    tank_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
):
    db = get_db()
    query: dict = {}
    if active_only:
        query["active"] = True
    if tank_id is not None:
        query["tank_id"] = tank_id

    docs = []
    async for doc in db.alarms.find(query).sort("start_time", -1).limit(limit):
        docs.append(_serialize(doc))
    return docs


@router.patch("/{alarm_id}/ack")
async def acknowledge_alarm(alarm_id: str, _: str = Depends(require_auth)):
    db = get_db()
    try:
        modified = await ack_alarm(alarm_id, db)
    except Exception:
        raise HTTPException(status_code=400, detail="ID de alarma inválido")
    if not modified:
        raise HTTPException(status_code=404, detail="Alarma no encontrada o ya reconocida")
    return {"success": True, "ack_time": datetime.now(timezone.utc).isoformat()}


@router.post("/reset")
async def reset_alarm_endpoint(_: str = Depends(require_auth)):
    db = get_db()
    success = await reset_alarm(db)
    return {"success": success}
