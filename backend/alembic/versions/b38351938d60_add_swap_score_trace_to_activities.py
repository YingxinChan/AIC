"""add swap_score_trace to activities

Revision ID: b38351938d60
Revises: e5f7a9c1b3d4
Create Date: 2026-08-04 17:29:43.703630

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b38351938d60'
down_revision: Union[str, Sequence[str], None] = 'e5f7a9c1b3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('activities', sa.Column('swap_score_trace', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('activities', 'swap_score_trace')
