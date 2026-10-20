"""add shop_name to users

Revision ID: 20261020_0003
Revises: 0d61e4935872
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261020_0003'
down_revision: Union[str, Sequence[str], None] = '0d61e4935872'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('shop_name', sa.String(length=150), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('users', 'shop_name')
