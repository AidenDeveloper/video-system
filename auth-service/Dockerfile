# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder
USER root
RUN apk update && apk upgrade
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

FROM python:3.12-slim
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN useradd --system --uid 10001 --no-create-home app
COPY --from=builder /opt/venv /opt/venv
WORKDIR /app
COPY app.py common.py manage.py ./
USER 10001
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5000/healthz',timeout=3)"
CMD ["sh","-c","python manage.py seed && exec gunicorn -b 0.0.0.0:5000 --threads 2 --access-logfile - app:app"]