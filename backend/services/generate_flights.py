import csv
import random
from datetime import datetime, timedelta

# Define regions to enforce duration logic
# Group 1: 1 hour
GROUP_1 = ["London, UK", "Edinburgh, UK", "Dublin, Ireland", "Brussels, Belgium", "Bruges, Belgium", "Amsterdam, Netherlands"]
# Group 2: 1.5 hours
GROUP_2 = ["Rome, Italy", "Florence, Italy", "Venice, Italy", "Milan, Italy", "Barcelona, Spain", "Madrid, Spain", "Lisbon, Portugal", "Zurich, Switzerland"]
# Group 3: 2 hours
GROUP_3 = ["Berlin, Germany", "Munich, Germany", "Paris, France"]
# Group 4: 3-4 hours (The "Far" cities)
GROUP_4 = ["Istanbul, Turkey", "Athens, Greece", "Oslo, Norway", "Copenhagen, Denmark", "Budapest, Hungary", "Krakow, Poland", "Vienna, Austria", "Prague, Czech Republic"]

def get_route_duration(origin, destination):
    # 1. Specific rules for flights involving London:
    if "London, UK" in [origin, destination]:
        if any(c in origin or c in destination for c in ["Italy", "Spain", "Portugal", "Switzerland"]):
            return 90 # 1.5h
        if any(c in origin or c in destination for c in ["Germany"]):
            return 120 # 2h
        return 60 # 1h for the rest of London flights
    
    # Helper to find which group a city belongs to
    def get_group(city):
        if city in GROUP_1: return 1
        if city in GROUP_2: return 2
        if city in GROUP_3: return 3
        if city in GROUP_4: return 4
        return 4 

    # 2. General rules for all other flights based on Groups
    group_org = get_group(origin)
    group_dest = get_group(destination)
    
    diff = abs(group_org - group_dest)
    
    if diff == 0:
        # Same group: 1 to 1.5 hours
        return random.choice([60, 75, 90]) 
    elif diff == 1:
        # Adjacent groups (e.g., Group 1 and Group 2): 2 hours
        return 120 
    else:
        # Far (2 or more groups apart): 3 to 4 hours
        return random.choice([180, 210, 240])

def generate_data():
    cities = GROUP_1 + GROUP_2 + GROUP_3 + GROUP_4
    
    # FIX: Use a dictionary mapping to real IATA codes
    airlines_map = {
        "British Airways": "BA",
        "EasyJet": "U2",
        "Ryanair": "FR",
        "Lufthansa": "LH",
        "KLM": "KL"
    }
    airline_names = list(airlines_map.keys())
    
    flights = []
    
    # Cache durations so the same route always has the same duration
    durations = {}
    
    for origin in cities:
        for destination in cities:
            if origin == destination: continue
            
            route = tuple(sorted([origin, destination]))
            if route not in durations:
                durations[route] = get_route_duration(origin, destination)
            
            dur_mins = durations[route]
            duration_td = timedelta(minutes=dur_mins)
            
            # Generate 4 flights per route
            for i in range(4):
                airline = random.choice(airline_names)
                iata_code = airlines_map[airline] # Fetch the real IATA code
                
                # FIX: Add a space between the IATA code and the numbers
                flight_num = f"{iata_code} {random.randint(100, 999)}"
                
                dep_hour = random.randint(6, 22)
                dep_min = random.choice([0, 15, 30, 45])
                dep_dt = datetime(2026, 7, 16, dep_hour, dep_min)
                arr_dt = dep_dt + duration_td
                
                flights.append([
                    airline, flight_num, origin, destination, 
                    dep_dt.strftime("%H:%M"), arr_dt.strftime("%H:%M"), 
                    f"{dur_mins // 60}h {dur_mins % 60}m"
                ])
    return flights

with open('mock_flights.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(["airline", "flight_number", "departure_city", "destination_city", "departure_time", "arrival_time", "duration"])
    writer.writerows(generate_data())

print("Database generated successfully with realistic, consistent durations.")