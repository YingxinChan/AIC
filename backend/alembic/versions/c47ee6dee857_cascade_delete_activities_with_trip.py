"""cascade delete activities with trip

Revision ID: c47ee6dee857
Revises: 22ae406a1452
Create Date: 2026-07-06 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c47ee6dee857'
down_revision: Union[str, Sequence[str], None] = '22ae406a1452'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint('activities_trip_id_fkey', 'activities', type_='foreignkey')
    op.create_foreign_key(
        'activities_trip_id_fkey', 'activities', 'trips',
        ['trip_id'], ['id'], ondelete='CASCADE',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('activities_trip_id_fkey', 'activities', type_='foreignkey')
    op.create_foreign_key(
        'activities_trip_id_fkey', 'activities', 'trips',
        ['trip_id'], ['id'],
    )
