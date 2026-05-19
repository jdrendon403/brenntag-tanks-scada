from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query

from ..core.database import get_db

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("/")
async def get_history(
    tank_id: Optional[int] = None,
    from_dt: Optional[datetime] = Query(default=None, alias="from"),
    to_dt: Optional[datetime] = Query(default=None, alias="to"),
    limit: int = Query(default=1440, le=10000),  # 1 día a 1 min = 1440
):
    db = get_db()
    query: dict = {}
    if tank_id is not None:
        query["tank_id"] = tank_id
    if from_dt or to_dt:
        query["timestamp"] = {}
        if from_dt:
            query["timestamp"]["$gte"] = from_dt
        if to_dt:
            query["timestamp"]["$lte"] = to_dt

    cursor = db.history.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)
