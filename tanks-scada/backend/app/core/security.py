from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from .config import settings

_bearer = HTTPBearer(auto_error=True)


def create_token(username: str) -> str:
    return jwt.encode(
        {"sub": username, "iat": datetime.now(timezone.utc)},
        settings.auth_secret,
        algorithm="HS256",
    )


async def require_auth(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    try:
        payload = jwt.decode(
            creds.credentials, settings.auth_secret, algorithms=["HS256"]
        )
        return payload["sub"]
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
