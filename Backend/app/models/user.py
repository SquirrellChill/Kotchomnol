from sqlalchemy import BigInteger, Boolean, Column, DateTime, Integer, String, TIMESTAMP, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True, unique=True)
    email = Column(String(255), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=True)

    # Profile Avatar
    profile_picture = Column(String(500), nullable=True)

    # Links this profile row to its Supabase auth.users record. Every user
    # has one — including Telegram logins, which get a Supabase "shadow"
    # account created via the admin API (see auth_telegram.py) so that
    # get_current_user only ever has to verify one kind of JWT.
    supabase_user_id = Column(UUID(as_uuid=True), nullable=True, unique=True, index=True)

    # Email Verification
    is_verified = Column(Boolean, nullable=False, default=False)
    email_verification_code = Column(String(255), nullable=True)
    email_verification_expires = Column(DateTime(timezone=True), nullable=True)
    email_verification_attempts = Column(Integer, nullable=False, default=0)
    email_verification_locked_until = Column(DateTime(timezone=True), nullable=True)

    # Telegram Auth
    telegram_id = Column(BigInteger, nullable=True, unique=True)
    telegram_username = Column(String(255), nullable=True)

    # Password Reset
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(
        TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True
    )

    sales = relationship("Sale", back_populates="user", cascade="all, delete-orphan")