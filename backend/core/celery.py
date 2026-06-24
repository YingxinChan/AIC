from celery import Celery
from core.config import settings

celery_app = Celery(
    "smarttrip",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"

# Upstash uses rediss:// (TLS) — disable cert verification for macOS compatibility
_ssl_opts = {"ssl_cert_reqs": None}
celery_app.conf.broker_use_ssl = _ssl_opts
celery_app.conf.redis_backend_use_ssl = _ssl_opts
