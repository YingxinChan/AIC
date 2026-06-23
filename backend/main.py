from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import auth, trips, itinerary, weather, flights, notifications

app = FastAPI(title="SmartTrip AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "code": "INTERNAL_ERROR"},
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
