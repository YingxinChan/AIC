from pydantic import BaseModel

class NotificationPrefsOut(BaseModel):
    email_enabled: bool

class UpdatePrefsRequest(BaseModel):
    email_enabled: bool
