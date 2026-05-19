from pydantic import BaseModel
from typing import Optional


class TankModbusConfig(BaseModel):
    height_register: int
    overflow_register: int
    switch_register: int


class TankConfig(BaseModel):
    tank_id: int
    name: str = ""
    product: str = ""
    density: float = 1.0       # kg/L
    diameter: float = 5.0      # metros (diámetro interno)
    max_height: float = 8.0    # metros
    alarm_height: Optional[float] = None  # override del registro Modbus; None = usa valor del PLC
    modbus: TankModbusConfig


class TankConfigUpdate(BaseModel):
    name: Optional[str] = None
    product: Optional[str] = None
    density: Optional[float] = None
    diameter: Optional[float] = None
    max_height: Optional[float] = None
    alarm_height: Optional[float] = None
    modbus: Optional[TankModbusConfig] = None


class TankState(BaseModel):
    tank_id: int
    name: str
    product: str
    height: float              # metros
    percentage: float          # 0–100
    volume: float              # litros
    weight: float              # kg
    overflow_limit: float      # metros
    switch_active: bool
    alarm: bool
    timestamp: str             # ISO 8601
