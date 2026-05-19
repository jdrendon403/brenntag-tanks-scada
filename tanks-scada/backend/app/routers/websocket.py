import json
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["websocket"])


class WebSocketManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict) -> None:
        message = json.dumps(data, default=str)
        dead: List[WebSocket] = []
        for ws in self.active:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = WebSocketManager()


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            # Mantiene la conexión abierta; ignora mensajes entrantes
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
