from pydantic import BaseModel

class NotificationPrefsOut(BaseModel):
    email_enabled: bool
    rain_threshold_mm: float

class UpdatePrefsRequest(BaseModel):
    email_enabled: bool
    rain_threshold_mm: float
