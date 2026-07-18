import csv
import os

def get_csv_path():
    """Returns the absolute path to the mock_flights.csv file."""
    return os.path.join(os.path.dirname(__file__), 'mock_flights.csv')

def search_flights(
    origin: str,
    departure: str,
    return_date: str,
    direction: str = "arrival",
    destination: str = "London",
    flight_number: str = "",
) -> dict:
    """
    Reads from the CSV database and filters based on user search parameters.
    """
    csv_path = get_csv_path()
    
    if not os.path.exists(csv_path):
        return {"error": "Database file not found. Please run generate_flights.py."}

    filtered_flights = []

    with open(csv_path, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row in reader:
            # 1. Filter by Cities
            # If direction is arrival (outbound), origin matches, destination matches
            # If direction is departure (return), destination matches, origin matches
            match = False
            if direction == "arrival":
                if origin.lower() in row['departure_city'].lower() and \
                   destination.lower() in row['destination_city'].lower():
                    match = True
            else: # Return leg
                if destination.lower() in row['departure_city'].lower() and \
                   origin.lower() in row['destination_city'].lower():
                    match = True
            
            # 2. Apply flight number filter if provided
            if match and flight_number:
                if flight_number.lower() not in row['flight_number'].lower():
                    match = False
            
            if match:
                filtered_flights.append(row)

    return {"flights": filtered_flights}