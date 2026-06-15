"""initial schema: bus_stops, bus_routes, monitored_trips, arrival_records

Revision ID: 9f8a7b6c5d4e
Revises:
Create Date: 2026-06-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "9f8a7b6c5d4e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    arrival_status = postgresql.ENUM(
        "early", "on_time", "delayed", name="arrival_status"
    )
    arrival_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "bus_stops",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("stop_id", sa.String(64), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
    )
    op.create_index("idx_bus_stops_stop_id", "bus_stops", ["stop_id"])

    op.create_table(
        "bus_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("route_id", sa.String(64), unique=True, nullable=False),
        sa.Column("route_number", sa.String(16), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
    )

    op.create_table(
        "monitored_trips",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "stop_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bus_stops.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "route_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bus_routes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_label", sa.String(255)),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "arrival_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "monitored_trip_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("monitored_trips.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("trip_id", sa.String(128), nullable=False),
        sa.Column("scheduled_arrival", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=False),
        sa.Column("delay_seconds", sa.Integer(), nullable=False),
        sa.Column("status", postgresql.ENUM("early", "on_time", "delayed", name="arrival_status", create_type=False), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_index(
        "idx_arrival_dedup",
        "arrival_records",
        ["monitored_trip_id", "trip_id", "scheduled_arrival"],
        unique=True,
    )
    op.create_index(
        "idx_arrival_monitored_time",
        "arrival_records",
        ["monitored_trip_id", "recorded_at"],
    )
    op.create_index(
        "idx_arrival_monitored_schedule",
        "arrival_records",
        ["monitored_trip_id", "scheduled_arrival"],
    )


def downgrade() -> None:
    op.drop_table("arrival_records")
    op.drop_table("monitored_trips")
    op.drop_table("bus_routes")
    op.drop_table("bus_stops")

    sa.Enum(name="arrival_status").drop(op.get_bind(), checkfirst=True)
