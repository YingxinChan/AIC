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
    # Rule: Same group = 1-1.5h. Adjacent = 2h. Far = 3-4h.
    # Specific rules for your requirements:
    if "London, UK" in [origin, destination]:
        if any(c in [origin, destination] for c in ["Italy", "Spain", "Portugal", "Switzerland"]):
            return 90 # 1.5h
        if any(c in [origin, destination] for c in ["Germany"]):
            return 120 # 2h
        return 60 # 1h for the rest
    
    # Default fallback based on region tiers if not London
    return 150 # 2.5h default

def generate_data():
    cities = GROUP_1 + GROUP_2 + GROUP_3 + GROUP_4
    airlines = ["British Airways", "EasyJet", "Ryanair", "Lufthansa", "KLM"]
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
                airline = random.choice(airlines)
                flight_num = f"{airline[0:2].upper()}{random.randint(100, 999)}"
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