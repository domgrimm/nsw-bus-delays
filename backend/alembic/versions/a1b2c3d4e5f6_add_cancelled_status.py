"""add cancelled to arrival_status

Revision ID: a1b2c3d4e5f6
Revises: 9f8a7b6c5d4e
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9f8a7b6c5d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE arrival_status ADD VALUE IF NOT EXISTS 'cancelled'")


def downgrade() -> None:
    pass
