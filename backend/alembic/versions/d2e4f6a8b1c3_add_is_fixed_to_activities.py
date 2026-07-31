"""add is_fixed to activities

Revision ID: d2e4f6a8b1c3
Revises: b7c9d3e1f4a2
Create Date: 2026-07-31 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2e4f6a8b1c3'
down_revision: Union[str, Sequence[str], None] = 'b7c9d3e1f4a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('activities', sa.Column('is_fixed', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('activities', 'is_fixed')
