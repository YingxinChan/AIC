from datetime import date
from sqlalchemy import String, Date, Boolean, ForeignKey
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
    is_swapped: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    alternate_name: Mapped[str] = mapped_column(String(255), default="", server_default="")
    alternate_location: Mapped[str] = mapped_column(String(255), default="", server_default="")
    swap_reason: Mapped[str] = mapped_column(String(255), default="", server_default="")
