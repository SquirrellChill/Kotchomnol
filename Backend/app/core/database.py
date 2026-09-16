"""
SQLAlchemy engine + session setup.

This mirrors what Sequelize's `sequelize.js` config file would do in a
Node.js project, but on the FastAPI/Python side: create one Engine,
one sessionmaker, and a declarative Base that all models inherit from.
"""

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

db_url = make_url(settings.DATABASE_URL)

print("=== DATABASE DEBUG ===")
print("DB USER:", db_url.username)
print("DB HOST:", db_url.host)
print("DB PORT:", db_url.port)
print("DB NAME:", db_url.database)
print("======================")

# pool_pre_ping=True avoids "MySQL server has gone away" errors on
# long-lived connections (same idea as Sequelize's `pool` options).
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("MAIL_SERVER:", settings.MAIL_SERVER)
print("MAIL_PORT:", settings.MAIL_PORT)
print("MAIL_USERNAME:", settings.MAIL_USERNAME)
print("MAIL_FROM:", settings.MAIL_FROM)
print("MAIL_PASSWORD configured:", bool(settings.MAIL_PASSWORD))