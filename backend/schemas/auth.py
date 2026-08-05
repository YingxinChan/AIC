from pydantic import BaseModel, EmailStr
from datetime import datetime

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

class AuthOut(BaseModel):
    user: UserOut
    # Only set on register/login (the frontend stores this and attaches it
    # as a Bearer header on every later request — see lib/api.js). /me has
    # no reason to re-issue it since the caller already has the one it sent.
    token: str | None = None
