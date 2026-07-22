from sqlalchemy import Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from models.base import Base

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    rain_threshold_mm: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
