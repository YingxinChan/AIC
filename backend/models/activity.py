from datetime import date, datetime
from typing import Any
from sqlalchemy import JSON, String, Date, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base

class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), nullable=False)
    day_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)  # "indoor" | "outdoor"
    time_slot: Mapped[str] = mapped_column(String(50), nullable=False)
    location: Mapped[str] = mapped_column(String(255), default="", server_default="")
    description: Mapped[str] = mapped_column(String(1000), default="", server_default="")
    lat: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    lng: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    is_swapped: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    alternate_name: Mapped[str] = mapped_column(String(255), default="", server_default="")
    alternate_location: Mapped[str] = mapped_column(String(255), default="", server_default="")
    swap_reason: Mapped[str] = mapped_column(String(255), default="", server_default="")

    # The per-metric scores (see services/weather_rules.py's
    # score_activity()) that triggered this swap — e.g.
    # {"scores": {"cold": 80, "wind": 50}, "combined": 100, "adjusted": 90}.
    # None for a rain-caused swap (rain isn't part of the scoring engine,
    # see auto_swap_service.py) or for an activity never swapped.
    swap_score_trace: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    # Pre-swap lat/lng, stashed by swap_service.apply_swap() before it moves
    # lat/lng to the alternate's coordinates (which have no other backup —
    # unlike name/location, which apply_swap never touches). None for an
    # activity never swapped; cleared back to None on revert.
    original_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    original_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Comma-separated subset of {"view_dependent", "wind_exposed",
    # "strenuous_outdoor", "beach"} — tagged by Claude at generation time,
    # read by services/weather_rules.py's targeted rules to decide which
    # activities a given weather condition actually affects. Empty string
    # (not one of the tags) means "not specifically weather-sensitive".
    weather_sensitivity: Mapped[str] = mapped_column(String(255), default="", server_default="")

    # User-set: marks this activity as already booked/committed (e.g. a
    # timed museum ticket) — excluded from weather auto-swap entirely, and
    # preserved (not deleted) across a full itinerary regeneration. See
    # services/itinerary_service.py generate_itinerary() and
    # services/auto_swap_service.py run_auto_swap().
    is_fixed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    # Revert-side counterparts to is_swapped/swap_reason/swap_score_trace
    # above — track only the most recent swap/revert cycle (same
    # latest-event-overwrites model already used for the swap fields, not a
    # full history). is_reverted distinguishes "never touched" from "was
    # swapped then reverted", since is_swapped=False alone can't tell those
    # apart. Set by services/swap_service.py's apply_swap()/revert_activity().
    swapped_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reverted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_reverted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    revert_reason: Mapped[str] = mapped_column(String(255), default="", server_default="")
    revert_score: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
