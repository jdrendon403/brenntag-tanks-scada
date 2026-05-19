import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.database import close_db, connect_db
from .modbus.client import modbus_client
from .modbus import poller
from .routers import alarms, config, history, tanks
from .routers.websocket import router as ws_router, ws_manager
from .services.datalogger import datalog_loop

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await modbus_client.connect()
    poller.ws_manager = ws_manager
    asyncio.create_task(poller.poll_loop())
    asyncio.create_task(datalog_loop())
    yield
    await modbus_client.disconnect()
    await close_db()


app = FastAPI(title="SCADA Tanques API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tanks.router)
app.include_router(config.router)
app.include_router(alarms.router)
app.include_router(history.router)
app.include_router(ws_router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "mock_modbus": settings.mock_modbus,
        "modbus_connected": modbus_client.is_connected,
    }
