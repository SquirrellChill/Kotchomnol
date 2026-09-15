"""add payments and subscriptions tables

Revision ID: 0d61e4935872
Revises: dbdfebedcd3c
Create Date: 2026-09-15 14:03:22.152345
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0d61e4935872"

down_revision: Union[str, Sequence[str], None] = "dbdfebedcd3c"

branch_labels: Union[str, Sequence[str], None] = None

depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create payments table
    op.create_table(
        "payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "plan",
            sa.Enum(
                "starter",
                "business",
                name="plantype",
            ),
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.Enum(
                "bakong",
                "aba_payway",
                name="paymentprovider",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "pending",
                "paid",
                "expired",
                "failed",
                name="paymentstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
        ),
        sa.Column(
            "currency",
            sa.String(length=3),
            nullable=False,
        ),
        sa.Column(
            "qr_string",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "md5_hash",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "deeplink",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "external_ref",
            sa.String(length=64),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "paid_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.user_id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Payment indexes
    op.create_index(
        op.f("ix_payments_md5_hash"),
        "payments",
        ["md5_hash"],
        unique=False,
    )

    op.create_index(
        op.f("ix_payments_status"),
        "payments",
        ["status"],
        unique=False,
    )

    op.create_index(
        op.f("ix_payments_user_id"),
        "payments",
        ["user_id"],
        unique=False,
    )

    # Create subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "plan",
            sa.Enum(
                "starter",
                "business",
                name="plantype",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "expired",
                "cancelled",
                name="subscriptionstatus",
            ),
            nullable=False,
        ),
        sa.Column(
            "current_period_start",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "current_period_end",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "last_payment_id",
            sa.UUID(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["last_payment_id"],
            ["payments.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.user_id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Subscription index
    op.create_index(
        op.f("ix_subscriptions_user_id"),
        "subscriptions",
        ["user_id"],
        unique=True,
    )


def downgrade() -> None:
    # Remove subscriptions table
    op.drop_index(
        op.f("ix_subscriptions_user_id"),
        table_name="subscriptions",
    )

    op.drop_table("subscriptions")

    # Remove payments indexes
    op.drop_index(
        op.f("ix_payments_user_id"),
        table_name="payments",
    )

    op.drop_index(
        op.f("ix_payments_status"),
        table_name="payments",
    )

    op.drop_index(
        op.f("ix_payments_md5_hash"),
        table_name="payments",
    )

    # Remove payments table
    op.drop_table("payments")