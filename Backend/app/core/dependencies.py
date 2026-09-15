from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.repositories.user_repository import find_user_by_supabase_id
from app.core.security import decode_supabase_token

# HTTPBearer just shows a plain "paste your token" field in Swagger's
# Authorize dialog, instead of OAuth2PasswordBearer's username/password
# form (which doesn't match our JSON-based /auth/login endpoint).
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Every route depends on this the same way it always did — only what's
    inside changed. The token is now the one Supabase issued at login (or,
    for Telegram, one minted locally with the identical shape), so `sub` is
    a Supabase auth.users UUID rather than our own integer user_id. Look the
    profile row up by that UUID instead.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_supabase_token(credentials.credentials)
        supabase_user_id: str | None = payload.get("sub")
        if supabase_user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = find_user_by_supabase_id(db, supabase_user_id)
    if user is None:
        raise credentials_exception
    return user