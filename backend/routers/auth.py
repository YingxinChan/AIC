from fastapi import APIRouter, Response, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import get_current_user, create_access_token
from core.database import get_db
from schemas.auth import RegisterRequest, LoginRequest, AuthOut
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut)
async def register(body: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register_user(db, body.email, body.password)
    token = create_access_token(user.id, user.email)
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax")
    return {"user": {"id": user.id, "email": user.email}}


@router.post("/login", response_model=AuthOut)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    user = await auth_service.login_user(db, body.email, body.password)
    token = create_access_token(user.id, user.email)
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax")
    return {"user": {"id": user.id, "email": user.email}}


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie("access_token")


@router.get("/me", response_model=AuthOut)
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
