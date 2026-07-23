import httpx
from core.config import settings

ORS_URL = "https://api.openrouteservice.org/v2/directions/foot-walking"


async def get_walking_distance(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> dict | None:
    if not settings.ors_api_key:
        return None
    params = {
        "api_key": settings.ors_api_key,
        "start": f"{from_lng},{from_lat}",
        "end": f"{to_lng},{to_lat}",
    }
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(ORS_URL, params=params, timeout=10)
        if r.status_code != 200:
            return None
        segment = r.json()["features"][0]["properties"]["segments"][0]
        return {
            "distance_m": round(segment["distance"]),
            "duration_min": round(segment["duration"] / 60),
        }
    except Exception:
        return None
