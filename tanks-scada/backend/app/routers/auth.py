from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core.config import settings
from ..core.security import create_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    if body.username != settings.auth_user or body.password != settings.auth_password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"access_token": create_token(body.username), "token_type": "bearer"}
