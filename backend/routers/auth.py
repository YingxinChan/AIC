from fastapi import APIRouter, Response, Depends
from core.security import get_current_user
from schemas.auth import RegisterRequest, LoginRequest, AuthOut
from services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=AuthOut)
async def register(body: RegisterRequest, response: Response):
    user = auth_service.register_user(body.email, body.password)
    response.set_cookie(key="access_token", value="stub-token", httponly=True)
    return {"user": user}

@router.post("/login", response_model=AuthOut)
async def login(body: LoginRequest, response: Response):
    user = auth_service.login_user(body.email, body.password)
    response.set_cookie(key="access_token", value="stub-token", httponly=True)
    return {"user": user}

@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie("access_token")

@router.get("/me", response_model=AuthOut)
async def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
