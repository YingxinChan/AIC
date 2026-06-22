from ml.predictor import predict_rain_volume, predict_flash_storm

def get_forecast(start: str, end: str) -> dict:
    # STUB — replace with real OWM fetch + ML predictor calls
    _ = predict_rain_volume({})
    _ = predict_flash_storm({})
    return {"status": "not_implemented"}
