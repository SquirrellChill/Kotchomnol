from datetime import datetime, timedelta, timezone

import bcrypt
import jwt as pyjwt
from jwt.exceptions import InvalidTokenError, PyJWKClientError
from jose import jwt, JWTError

from app.core.config import settings


# ============================================================
# SUPABASE JWT / JWKS
# ============================================================

SUPABASE_JWKS_URL = (
    f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
)

supabase_jwks_client = pyjwt.PyJWKClient(SUPABASE_JWKS_URL)


# ============================================================
# PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    """
    Hash password using bcrypt.

    Supabase Auth normally handles passwords for email/password
    authentication. This function is kept for legacy/local flows.
    """
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    )

    return hashed.decode("utf-8")


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    """
    Verify password against bcrypt hash.
    """
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# ============================================================
# LOCAL HS256 TOKEN
# ============================================================

def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a local HS256 JWT.

    Used by local/legacy authentication flows.
    """

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode["exp"] = expire

    return jwt.encode(
        to_encode,
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )


# ============================================================
# TELEGRAM TOKEN
# ============================================================

def mint_supabase_compatible_token(
    user_id: str,
    email: str | None = None,
    user_metadata: dict | None = None,
) -> str:
    """
    Create an HS256 token for the Telegram authentication flow.

    This token is intentionally compatible with the local token
    verification handled by decode_supabase_token().
    """

    now = datetime.now(timezone.utc)

    expires_at = now + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    if email:
        payload["email"] = email

    if user_metadata:
        payload["user_metadata"] = user_metadata

    return jwt.encode(
        payload,
        settings.SUPABASE_JWT_SECRET,
        algorithm="HS256",
    )


# ============================================================
# TOKEN DECODING
# ============================================================

def decode_supabase_token(token: str) -> dict:
    """
    Verify and decode authentication tokens.

    Supported:

    ES256
        Supabase Auth tokens.
        Verified using Supabase JWKS.

    HS256
        Telegram/local tokens.
        Verified using SUPABASE_JWT_SECRET.
    """

    try:
        # ----------------------------------------------------
        # Read JWT header
        # ----------------------------------------------------

        header = pyjwt.get_unverified_header(token)

        algorithm = header.get("alg")

        # ----------------------------------------------------
        # SUPABASE AUTH
        #
        # Supabase currently uses ES256.
        # Get the public signing key from Supabase JWKS.
        # ----------------------------------------------------

        if algorithm == "ES256":

            signing_key = (
                supabase_jwks_client.get_signing_key_from_jwt(
                    token
                )
            )

            payload = pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
                issuer=f"{settings.SUPABASE_URL}/auth/v1",
            )

            return payload

        # ----------------------------------------------------
        # TELEGRAM / LOCAL AUTH
        #
        # These tokens use HS256.
        # ----------------------------------------------------

        if algorithm == "HS256":

            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )

            return payload

        # ----------------------------------------------------
        # Unsupported algorithm
        # ----------------------------------------------------

        raise JWTError(
            f"Unsupported token algorithm: {algorithm}"
        )

    except (
        InvalidTokenError,
        PyJWKClientError,
    ) as exc:

        raise JWTError(str(exc)) from exc