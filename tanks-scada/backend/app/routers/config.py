import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from ..core.database import get_db
from ..core.security import require_auth
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
async def update_tank_config(tank_id: int, body: TankConfigUpdate, _: str = Depends(require_auth)):
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


@router.post("/tanks/{tank_id}/calibration")
async def upload_calibration(tank_id: int, file: UploadFile = File(...), _: str = Depends(require_auth)):
    """Carga una tabla de aforo desde CSV con columnas height_mm y volume_l."""
    db = get_db()
    try:
        content = (await file.read()).decode("utf-8-sig")
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo")

    reader = csv.DictReader(io.StringIO(content))
    required = {"height_mm", "volume_l"}
    table: list[dict] = []
    try:
        for row in reader:
            if not required.issubset(row.keys()):
                raise HTTPException(status_code=400, detail=f"El CSV debe tener columnas: {required}")
            table.append({"height_mm": float(row["height_mm"]), "volume_l": float(row["volume_l"])})
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail="Error en los valores del CSV. Verifique que sean numéricos.")

    if not table:
        raise HTTPException(status_code=400, detail="El CSV no contiene datos")

    heights = [r["height_mm"] for r in table]
    if heights != sorted(heights):
        raise HTTPException(status_code=400, detail="Las alturas deben estar en orden ascendente")

    result = await db.tanks_config.update_one(
        {"tank_id": tank_id},
        {"$set": {"calibration_table": table}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")

    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc),
        "tank_id": tank_id,
        "changes": {"calibration_table": f"{len(table)} puntos cargados desde CSV"},
    })

    return {"tank_id": tank_id, "points_loaded": len(table)}


@router.post("/tanks/{tank_id}/sensor-range/write")
async def write_sensor_range_to_plc(tank_id: int, _: str = Depends(require_auth)):
    """Lee el sensor_range configurado en DB y escribe los valores al PLC vía Modbus FC16."""
    from ..modbus.client import modbus_client

    db = get_db()
    cfg = await db.tanks_config.find_one({"tank_id": tank_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")

    sr = cfg.get("sensor_range")
    if not sr:
        raise HTTPException(status_code=400, detail="El tanque no tiene rango de sensor configurado")

    ok_min = await modbus_client.write_float32(sr["min_register"], sr["min_value"])
    ok_max = await modbus_client.write_float32(sr["max_register"], sr["max_value"])

    if not (ok_min and ok_max):
        raise HTTPException(status_code=502, detail="Error al escribir en el PLC")

    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc),
        "tank_id": tank_id,
        "changes": {"sensor_range_written_to_plc": sr},
    })

    return {"ok": True, "min_written": ok_min, "max_written": ok_max}


@router.post("/tanks/{tank_id}/overflow-limit/write")
async def write_overflow_limit_to_plc(tank_id: int, _: str = Depends(require_auth)):
    """Escribe alarm_height al registro overflow del PLC vía Modbus FC16."""
    from ..modbus.client import modbus_client

    db = get_db()
    cfg = await db.tanks_config.find_one({"tank_id": tank_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")

    alarm_height = cfg.get("alarm_height")
    if alarm_height is None:
        raise HTTPException(status_code=400, detail="El tanque no tiene altura de alarma configurada")

    overflow_register = cfg["modbus"]["overflow_register"]
    ok = await modbus_client.write_float32(overflow_register, alarm_height)

    if not ok:
        raise HTTPException(status_code=502, detail="Error al escribir en el PLC")

    await db.audit_log.insert_one({
        "timestamp": datetime.now(timezone.utc),
        "tank_id": tank_id,
        "changes": {"overflow_limit_written_to_plc": {"register": overflow_register, "value": alarm_height}},
    })

    return {"ok": True, "register": overflow_register, "value_written": alarm_height}


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
