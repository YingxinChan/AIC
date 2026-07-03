# Mock flight data for demo purposes
# Mock flight data for demo purposes
MOCK_FLIGHTS = [
    {
        "airline": "British Airways",
        "flight_number": "BA 112",
        "departure_city": "Paris",
        "departure_time": "08:00",
        "arrival_time": "08:15",
        "duration": "1h 15m",
        "price": 89
    },
    {
        "airline": "EasyJet",
        "flight_number": "U2 8456",
        "departure_city": "Paris",
        "departure_time": "10:30",
        "arrival_time": "10:45",
        "duration": "1h 15m",
        "price": 34
    },
    {
        "airline": "Ryanair",
        "flight_number": "FR 3110",
        "departure_city": "Paris",
        "departure_time": "14:00",
        "arrival_time": "14:15",
        "duration": "1h 15m",
        "price": 40
    },
    {
        "airline": "British Airways",
        "flight_number": "BA 993",
        "departure_city": "Berlin",
        "departure_time": "09:00",
        "arrival_time": "10:00",
        "duration": "2h 00m",
        "price": 83
    },
    {
        "airline": "Ryanair",
        "flight_number": "FR 144",
        "departure_city": "Berlin",
        "departure_time": "09:00",
        "arrival_time": "10:00",
        "duration": "2h 00m",
        "price": 48
    },
    {
        "airline": "EasyJet",
        "flight_number": "U2 5461",
        "departure_city": "Berlin",
        "departure_time": "16:00",
        "arrival_time": "17:00",
        "duration": "2h 00m",
        "price": 39
    }
]

# We MUST keep the exact arguments from the original stub!
def search_flights(origin: str, departure: str, return_date: str) -> dict:
    """
    Returns mock flight data matching the exact signature of the router.
    `departure` represents the departure date string from the frontend.
    `return_date` represents the return date string from the frontend.
    """
    # Loosely filter by origin city (case-insensitive)
    results = [f for f in MOCK_FLIGHTS if origin and origin.lower() in f["departure_city"].lower()]
    
    # Fallback: if city doesn't match our short list, return the first 3 items anyway for the demo
    if not results:
        results = MOCK_FLIGHTS[:3]
        
    return {"flights": results}