from pydantic import BaseModel
from datetime import datetime


class HistoryRecord(BaseModel):
    tank_id: int
    timestamp: datetime
    height: float
    percentage: float
    weight: float
    volume: float
    switch_active: bool
