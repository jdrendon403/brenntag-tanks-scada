from pydantic import BaseModel
from typing import Optional


class TankModbusConfig(BaseModel):
    height_register: int
    overflow_register: int
    switch_register: int


class CalibrationPoint(BaseModel):
    height_mm: float
    volume_l: float


class SensorRange(BaseModel):
    min_value: float = 0.0      # metros en el 0 % de la señal analógica
    max_value: float = 10.0     # metros en el 100 % de la señal analógica
    min_register: int = 0       # registro holding Modbus para escribir el mínimo
    max_register: int = 0       # registro holding Modbus para escribir el máximo


class TankConfig(BaseModel):
    tank_id: int
    name: str = ""
    product: str = ""
    density: float = 1.0       # kg/L
    diameter: float = 5.0      # metros — solo se usa como fallback sin tabla de aforo
    max_height: float = 8.0    # metros — solo se usa como fallback sin tabla de aforo
    alarm_height: Optional[float] = None  # override del registro Modbus; None = usa valor del PLC
    modbus: TankModbusConfig
    calibration_table: list[CalibrationPoint] = []
    sensor_range: Optional[SensorRange] = None


class TankConfigUpdate(BaseModel):
    name: Optional[str] = None
    product: Optional[str] = None
    density: Optional[float] = None
    diameter: Optional[float] = None
    max_height: Optional[float] = None
    alarm_height: Optional[float] = None
    modbus: Optional[TankModbusConfig] = None
    calibration_table: Optional[list[CalibrationPoint]] = None
    sensor_range: Optional[SensorRange] = None


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
