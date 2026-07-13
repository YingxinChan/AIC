# Mock flight data for demo purposes
MOCK_FLIGHTS = [
    {
        "airline": "British Airways",
        "flight_number": "BA 112",
        "departure_city": "Paris",
        "departure_time": "08:00",
        "arrival_time": "08:15",
        "duration": "1h 15m",
    },
    {
        "airline": "EasyJet",
        "flight_number": "U2 8456",
        "departure_city": "Paris",
        "departure_time": "10:30",
        "arrival_time": "10:45",
        "duration": "1h 15m"
    },
    {
        "airline": "Ryanair",
        "flight_number": "FR 3110",
        "departure_city": "Paris",
        "departure_time": "14:00",
        "arrival_time": "14:15",
        "duration": "1h 15m",
    },
    {
        "airline": "British Airways",
        "flight_number": "BA 993",
        "departure_city": "Berlin",
        "departure_time": "09:00",
        "arrival_time": "10:00",
        "duration": "2h 00m",
    },
    {
        "airline": "Ryanair",
        "flight_number": "FR 144",
        "departure_city": "Berlin",
        "departure_time": "09:00",
        "arrival_time": "10:00",
        "duration": "2h 00m",
    },
    {
        "airline": "EasyJet",
        "flight_number": "U2 5461",
        "departure_city": "Berlin",
        "departure_time": "16:00",
        "arrival_time": "17:00",
        "duration": "2h 00m",
    }
]

def search_flights(
    origin: str,
    departure: str,
    return_date: str,
    direction: str = "arrival",
    destination: str = "London",
    flight_number: str = "",
) -> dict:
    """
    Returns mock flight data matching the exact signature of the router.
    `departure` represents the departure date string from the frontend.
    `return_date` represents the return date string from the frontend.
    `destination` is the trip's destination city (defaults to "London" for
    the MVP). `direction` is "arrival" (flying into `destination`, default)
    or "departure" (flying out of `destination`) — flights are mock-only, so
    "departure" just relabels the same mock set as originating in
    `destination` instead of modeling a separate return-flight dataset.
    `flight_number`, if given, narrows results to a specific flight — no
    fallback applies here, since it's an explicit lookup, not a loose search.
    """
    # Loosely filter by origin city (case-insensitive)
    results = [f for f in MOCK_FLIGHTS if origin and origin.lower() in f["departure_city"].lower()]

    # Fallback: if city doesn't match our short list, return the first 3 items anyway for the demo
    if not results:
        results = MOCK_FLIGHTS[:3]

    if flight_number:
        results = [f for f in results if flight_number.lower() in f["flight_number"].lower()]

    if direction == "departure":
        results = [
            {**f, "departure_city": destination, "destination_city": f["departure_city"]}
            for f in results
        ]

    return {"flights": results}