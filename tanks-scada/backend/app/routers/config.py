from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from ..core.database import get_db
from ..models.tank import TankConfig, TankConfigUpdate

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/tanks")
async def get_all_configs():
    db = get_db()
    configs = await db.tanks_config.find({}, {"_id": 0}).to_list(length=None)
    return configs


@router.get("/tanks/{tank_id}")
async def get_tank_config(tank_id: int):
    db = get_db()
    cfg = await db.tanks_config.find_one({"tank_id": tank_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")
    return cfg


@router.put("/tanks/{tank_id}")
async def update_tank_config(tank_id: int, body: TankConfigUpdate):
    db = get_db()
    # exclude_unset para distinguir "no enviado" de "enviado como null"
    raw = body.model_dump(exclude_unset=True)
    if not raw:
        raise HTTPException(status_code=400, detail="Sin campos para actualizar")

    # Campos explícitamente null → $unset; resto → $set
    set_fields = {k: v for k, v in raw.items() if v is not None}
    unset_fields = {k: "" for k, v in raw.items() if v is None}

    mongo_op: dict = {}
    if set_fields:
        mongo_op["$set"] = set_fields
    if unset_fields:
        mongo_op["$unset"] = unset_fields

    result = await db.tanks_config.update_one({"tank_id": tank_id}, mongo_op)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")

    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc),
        "tank_id": tank_id,
        "changes": raw,
    })

    cfg = await db.tanks_config.find_one({"tank_id": tank_id}, {"_id": 0})
    return cfg


@router.get("/plc")
async def get_plc_config():
    from ..core.config import settings
    return {"host": settings.plc_host, "port": settings.plc_port, "mock": settings.mock_modbus}


@router.get("/audit")
async def get_audit_log(
    tank_id: Optional[int] = None,
    limit: int = Query(default=100, le=500),
):
    db = get_db()
    query: dict = {}
    if tank_id is not None:
        query["tank_id"] = tank_id
    cursor = db.audit_log.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return await cursor.to_list(length=limit)
