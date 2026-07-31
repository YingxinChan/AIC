"""add weather_sensitivity to activities

Revision ID: b7c9d3e1f4a2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c9d3e1f4a2'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('activities', sa.Column('weather_sensitivity', sa.String(length=255), server_default='', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('activities', 'weather_sensitivity')
