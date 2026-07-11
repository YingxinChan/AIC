from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    created_at:datetime

class AuthOut(BaseModel):
    user: UserOut
