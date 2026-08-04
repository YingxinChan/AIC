"""drop rain_threshold_mm from notification_preferences

Revision ID: c9d1e2f3a4b5
Revises: b38351938d60
Create Date: 2026-08-04 21:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d1e2f3a4b5'
down_revision: Union[str, Sequence[str], None] = 'b38351938d60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('notification_preferences', 'rain_threshold_mm')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        'notification_preferences',
        sa.Column('rain_threshold_mm', sa.Float(), server_default='0', nullable=False),
    )
