"""add original_plan to trips

Revision ID: 78fd5965dcf6
Revises: a361e0b688a6
Create Date: 2026-07-06 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78fd5965dcf6'
down_revision: Union[str, Sequence[str], None] = 'a361e0b688a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('trips', sa.Column('original_plan', sa.String(length=2000), server_default='', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('trips', 'original_plan')
