"""add hotel lat lng to trips

Revision ID: e5f7a9c1b3d4
Revises: d2e4f6a8b1c3
Create Date: 2026-08-02 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f7a9c1b3d4'
down_revision: Union[str, Sequence[str], None] = 'd2e4f6a8b1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('trips', sa.Column('hotel_lat', sa.Float(), nullable=True))
    op.add_column('trips', sa.Column('hotel_lng', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trips', 'hotel_lng')
    op.drop_column('trips', 'hotel_lat')
