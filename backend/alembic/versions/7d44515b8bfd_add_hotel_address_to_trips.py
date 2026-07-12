"""add hotel_address to trips

Revision ID: 7d44515b8bfd
Revises: 78fd5965dcf6
Create Date: 2026-07-06 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d44515b8bfd'
down_revision: Union[str, Sequence[str], None] = '78fd5965dcf6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('trips', sa.Column('hotel_address', sa.String(length=500), server_default='', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trips', 'hotel_address')
