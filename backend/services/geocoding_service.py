import requests

def geocode(query: str) -> tuple[float, float] | None:
    if not query:
        return None
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"format": "json", "limit": 1, "q": query},
            headers={"User-Agent": "SmartTripAI/0.1 (prototype)"},
            timeout=5,
        )
        if response.status_code != 200:
            return None
        results = response.json()
        if not results:
            return None
        return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        return None
