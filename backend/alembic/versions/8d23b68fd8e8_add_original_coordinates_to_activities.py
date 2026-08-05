"""add original coordinates to activities

Revision ID: 8d23b68fd8e8
Revises: c9d1e2f3a4b5
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d23b68fd8e8'
down_revision: Union[str, Sequence[str], None] = 'c9d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('activities', sa.Column('original_lat', sa.Float(), nullable=True))
    op.add_column('activities', sa.Column('original_lng', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('activities', 'original_lng')
    op.drop_column('activities', 'original_lat')
