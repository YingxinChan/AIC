from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import get_current_user, create_access_token
from core.database import get_db
from schemas.auth import RegisterRequest, LoginRequest, AuthOut
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthOut)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.register_user(db, body.email, body.password)
    token = create_access_token(user.id, user.email)
    return {"user": {"id": user.id, "email": user.email, "created_at": user.created_at}, "token": token}


@router.post("/login", response_model=AuthOut)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await auth_service.login_user(db, body.email, body.password)
    token = create_access_token(user.id, user.email)
    return {"user": {"id": user.id, "email": user.email, "created_at": user.created_at}, "token": token}


@router.post("/logout", status_code=204)
async def logout():
    # Nothing to do server-side — the token lives in the frontend's
    # localStorage (see lib/api.js), not a cookie, so "logging out" is just
    # the frontend discarding it. Kept as a real endpoint (rather than
    # removed) so the frontend has a stable place to call on logout even if
    # server-side revocation gets added later.
    pass


@router.get("/me", response_model=AuthOut)
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
