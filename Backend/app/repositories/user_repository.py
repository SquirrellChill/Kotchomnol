from sqlalchemy.orm import Session

from app.models.user import User


def find_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def find_user_by_phone_number(db: Session, phone_number: str) -> User | None:
    return db.query(User).filter(User.phone_number == phone_number).first()


def find_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def find_user_by_supabase_id(db: Session, supabase_user_id) -> User | None:
    """The profile row linked to a Supabase auth.users id.

    This is what get_current_user calls on every authenticated request now
    that the JWT's `sub` claim is a Supabase user id, not our own
    auto-incrementing user_id.
    """
    return db.query(User).filter(User.supabase_user_id == supabase_user_id).first()


def find_user_by_reset_token_hash(db: Session, hashed_token: str) -> User | None:
    return db.query(User).filter(User.password_reset_token == hashed_token).first()

def find_user_by_telegram_id(db: Session, telegram_id: int) -> User | None:
    return db.query(User).filter(User.telegram_id == telegram_id).first()


def create_user_telegram(
    db: Session, telegram_id: int, telegram_username: str | None,
    first_name: str | None, last_name: str | None, supabase_user_id=None,
) -> User:
    user = User(
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        first_name=first_name,
        last_name=last_name,
        phone_number=None,
        password_hash=None,
        supabase_user_id=supabase_user_id,
        is_verified=True,  # Telegram itself is the verification step.
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
        

def create_user(
    db: Session,
    first_name: str,
    last_name: str,
    phone_number: str,
    email: str,
    supabase_user_id,
    password_hash: str | None = None,
) -> User:
    """Local profile row for a Supabase-registered user.

    password_hash is accepted for backward compatibility with callers but is
    no longer used to authenticate anyone — Supabase owns the password now.
    """
    user = User(
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        email=email,
        password_hash=password_hash,
        supabase_user_id=supabase_user_id,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def save_user(db: Session, user: User) -> User:
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
