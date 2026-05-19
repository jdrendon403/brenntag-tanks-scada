from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlarmRecord(BaseModel):
    tank_id: int
    origin: str                        # "height" | "switch"
    start_time: datetime
    ack_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    active: bool = True
