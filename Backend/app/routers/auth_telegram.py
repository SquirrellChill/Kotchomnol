"""Telegram login.

Telegram never goes through Supabase's own signup flow — there's no email
or password to hand it. Instead, each Telegram user gets a "shadow"
Supabase auth.users record created once via the admin API (a synthetic,
unreachable email; nobody ever logs into it directly), and every login
after that mints a Supabase-shaped JWT locally for that same id. See
security.mint_supabase_compatible_token for why that token is
indistinguishable from one Supabase issued itself — it's what lets
get_current_user stay a single code path for every login method.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import mint_supabase_compatible_token
from app.core.supabase_client import get_supabase_admin
from app.repositories import user_repository as user_repo
from app.schemas.user import TelegramAuthRequest
from app.schemas.user import UserOut
from app.services.telegram_service import verify_telegram_login, TelegramAuthError

router = APIRouter(prefix="/auth/telegram", tags=["auth-telegram"])


def _ensure_supabase_shadow_user(telegram_id: int) -> str:
    """Create (or reuse, if this races) the Supabase auth user for a
    Telegram id and return its UUID as a string.

    email_confirm=True skips Supabase's normal "click the link" step, since
    nobody can open this inbox to click anything — Telegram's own login
    widget is the verification.
    """
    admin = get_supabase_admin().auth.admin
    synthetic_email = f"telegram-{telegram_id}@users.noreply.kotchomnol.app"

    try:
        result = admin.create_user(
            {
                "email": synthetic_email,
                "email_confirm": True,
                "user_metadata": {"telegram_id": telegram_id, "provider": "telegram"},
            }
        )
        return str(result.user.id)
    except Exception:
        # Most likely: this Telegram id's shadow user already exists (a
        # retry, or a concurrent login). Look it up by the same synthetic
        # email rather than assuming failure means something is wrong.
        for existing in admin.list_users():
            if existing.email == synthetic_email:
                return str(existing.id)
        raise


@router.post("/login")
def telegram_login(payload: TelegramAuthRequest, db: Session = Depends(get_db)):
    try:
        claims = verify_telegram_login(payload.id_token)
    except TelegramAuthError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    telegram_id = int(claims["sub"])
    user = user_repo.find_user_by_telegram_id(db, telegram_id)

    if not user:
        supabase_user_id = _ensure_supabase_shadow_user(telegram_id)
        try:
            user = user_repo.create_user_telegram(
                db,
                telegram_id=telegram_id,
                telegram_username=claims.get("preferred_username"),
                first_name=claims.get("given_name") or claims.get("name") or "Telegram User",
                last_name=claims.get("family_name") or "",
                supabase_user_id=supabase_user_id,
            )
        except IntegrityError as exc:
            db.rollback()
            user = user_repo.find_user_by_telegram_id(db, telegram_id)
            if not user:
                raise HTTPException(
                    status_code=409,
                    detail="Unable to create Telegram account.",
                ) from exc
        except SQLAlchemyError as exc:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Unable to complete Telegram login.",
            ) from exc

    if not user.supabase_user_id:
        # Backfill for a profile row created before this migration.
        user.supabase_user_id = _ensure_supabase_shadow_user(telegram_id)
        user = user_repo.save_user(db, user)

    token = mint_supabase_compatible_token(user.supabase_user_id)

    return {
        "success": True,
        "message": "Login successful",
        "data": {"token": token, "user": UserOut.model_validate(user)},
    }

