import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.config import settings
from routers import auth, trips, itinerary, weather, flights, notifications

logger = logging.getLogger(__name__)

app = FastAPI(title="ClimaGo", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # The raw exception (str(exc)) is never sent to the caller — it can
    # contain internal details (DB column/table names, library internals,
    # query fragments) that shouldn't leak to whoever hit the API, including
    # an unauthenticated caller sending bad input on purpose. Logged
    # server-side instead, where it's actually useful for debugging.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected error occurred.", "code": "INTERNAL_ERROR"},
    )

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(itinerary.router)
app.include_router(weather.router)
app.include_router(flights.router)
app.include_router(notifications.router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
