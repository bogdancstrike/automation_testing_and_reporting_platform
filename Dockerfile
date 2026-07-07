# QTP modulith image — one image, two entrypoints.
#
# The same image runs the backend (API + scheduler) and the worker (Kafka
# consumer); the compose services differ only by working_dir + command:
#   backend: working_dir /app/backend, gunicorn -c gunicorn.conf.py wsgi:app
#   worker:  working_dir /app/worker,  PYTHONPATH=/app/backend gunicorn ... wsgi:app
#
# All shared code lives in /app/backend/src and is imported by both entrypoints.
FROM python:3.12-slim AS builder

WORKDIR /build

COPY backend/requirements.txt .
COPY backend/dist/qf-1.0.2-py3-none-any.whl dist/

RUN pip install --no-cache-dir --prefix=/install \
    dist/qf-1.0.2-py3-none-any.whl \
    -r requirements.txt


FROM python:3.12-slim

RUN useradd --create-home --shell /bin/bash appuser
WORKDIR /app

COPY --from=builder /install /usr/local
COPY backend/ /app/backend/
COPY worker/ /app/worker/

RUN chown -R appuser:appuser /app
USER appuser

# Default to the backend entrypoint; the worker service overrides working_dir,
# PYTHONPATH and command in docker-compose.
WORKDIR /app/backend
EXPOSE 5100
CMD ["gunicorn", "-c", "gunicorn.conf.py", "wsgi:app"]
