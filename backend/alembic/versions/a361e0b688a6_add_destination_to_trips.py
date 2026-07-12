"""add destination to trips

Revision ID: a361e0b688a6
Revises: c47ee6dee857
Create Date: 2026-07-06 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a361e0b688a6'
down_revision: Union[str, Sequence[str], None] = 'c47ee6dee857'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('trips', sa.Column('destination', sa.String(length=100), server_default='London', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trips', 'destination')
