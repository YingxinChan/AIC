# STUB — replace with real Celery task dispatch and DB operations

def get_itinerary(trip_id: int) -> dict:
    return {"status": "not_implemented"}

def generate_itinerary(trip_id: int) -> dict:
    return {"job_id": "stub-job-id", "status": "queued"}

def swap_activity(trip_id: int, activity_id: int, swap_to: str) -> dict:
    return {"status": "not_implemented", "data": {}}
