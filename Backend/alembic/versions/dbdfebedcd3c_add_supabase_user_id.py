"""add supabase user id

Revision ID: dbdfebedcd3c
Revises: 443ac4798c82
Create Date: 2026-09-15 10:35:00.226144
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "dbdfebedcd3c"
down_revision: Union[str, Sequence[str], None] = "443ac4798c82"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "supabase_user_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_users_supabase_user_id",
        "users",
        ["supabase_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_users_supabase_user_id",
        table_name="users",
    )

    op.drop_column(
        "users",
        "supabase_user_id",
    )