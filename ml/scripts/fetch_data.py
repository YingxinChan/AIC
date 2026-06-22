"""
STUB — Fetch historical weather data from NASA POWER and OpenWeatherMap.

When implemented:
  1. Pull NASA POWER daily data for London (lat=51.5074, lon=-0.1278) for the past 5+ years
  2. Pull OWM historical data for the same period
  3. Save raw CSVs to ml/data/raw/

Run: python ml/scripts/fetch_data.py
"""

def fetch_nasa_power(lat: float, lon: float, start_year: int, end_year: int):
    # STUB
    raise NotImplementedError("fetch_nasa_power not yet implemented")

def fetch_owm_historical(lat: float, lon: float, start_year: int, end_year: int):
    # STUB
    raise NotImplementedError("fetch_owm_historical not yet implemented")

if __name__ == "__main__":
    print("fetch_data.py: STUB — not yet implemented")
