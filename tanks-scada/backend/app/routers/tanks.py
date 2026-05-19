from fastapi import APIRouter, HTTPException

from ..modbus.poller import tank_states

router = APIRouter(prefix="/api/tanks", tags=["tanks"])


@router.get("/")
async def get_all_tanks():
    return list(tank_states.values())


@router.get("/{tank_id}")
async def get_tank(tank_id: int):
    if tank_id not in tank_states:
        raise HTTPException(status_code=404, detail=f"Tanque {tank_id} no encontrado")
    return tank_states[tank_id]
