from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base

class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), default="London", server_default="London")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    arrival_flight_number: Mapped[str] = mapped_column(String(20), default="", server_default="")
    arrival_airline: Mapped[str] = mapped_column(String(100), default="", server_default="")
    arrival_time: Mapped[str] = mapped_column(String(10), default="", server_default="")
    departure_flight_number: Mapped[str] = mapped_column(String(20), default="", server_default="")
    departure_airline: Mapped[str] = mapped_column(String(100), default="", server_default="")
    departure_time: Mapped[str] = mapped_column(String(10), default="", server_default="")

    original_plan: Mapped[str] = mapped_column(String(2000), default="", server_default="")
    hotel_address: Mapped[str] = mapped_column(String(500), default="", server_default="")
