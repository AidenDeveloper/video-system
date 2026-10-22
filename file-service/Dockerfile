# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

FROM python:3.12-slim
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN useradd --system --uid 10001 --no-create-home app && mkdir /data && chown 10001 /data
COPY --from=builder /opt/venv /opt/venv
WORKDIR /app
COPY app.py ./
USER 10001
EXPOSE 5001
HEALTHCHECK --interval=15s --timeout=4s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:5001/healthz',timeout=3)"
CMD ["gunicorn","-b","0.0.0.0:5001","--threads","4","--timeout","300","--access-logfile","-","app:app"]