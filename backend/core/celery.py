import ssl

from celery import Celery
from celery.schedules import crontab
from core.config import settings

celery_app = Celery(
    "smarttrip",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"

# Re-checks weather for upcoming/active trips and auto-swaps rained-out
# outdoor activities to an indoor alternative (backend/tasks.py).
celery_app.conf.beat_schedule = {
    "check-weather-swaps": {
        "task": "tasks.check_weather_swaps",
        "schedule": crontab(minute=0, hour="*/3"),
    },
}

# Upstash uses rediss:// (TLS) — disable cert verification for macOS compatibility.
# Celery 5.6+ requires the actual ssl.CERT_NONE constant here, not plain None —
# passing None raises "A rediss:// URL must have parameter ssl_cert_reqs ...".
_ssl_opts = {"ssl_cert_reqs": ssl.CERT_NONE}
celery_app.conf.broker_use_ssl = _ssl_opts
celery_app.conf.redis_backend_use_ssl = _ssl_opts
