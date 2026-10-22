import os, re, hmac, logging
from flask import Flask, request, jsonify, abort, send_from_directory

logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s files: %(message)s")
log = logging.getLogger("files")

def secret(name):
    p = os.environ.get(f"{name}_FILE")
    return open(p).read().strip() if p else os.environ.get(name, "")

DATA_DIR = os.environ.get("DATA_DIR", "/data")
API_KEY = secret("INTERNAL_API_KEY")
NAME_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|webm)$")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 210 * 1024 * 1024

def guard(name):
    if not API_KEY or not hmac.compare_digest(request.headers.get("X-API-Key", ""), API_KEY):
        log.warning("rejected request without valid api key from %s", request.remote_addr)
        abort(401)
    if not NAME_RE.match(name):
        abort(400)

@app.put("/files/<name>")
def put_file(name):
    guard(name)
    path, tmp = os.path.join(DATA_DIR, name), os.path.join(DATA_DIR, name + ".part")
    try:
        with open(tmp, "wb") as f:
            while chunk := request.stream.read(1024 * 1024):
                f.write(chunk)
        os.replace(tmp, path)
    except OSError as e:
        log.error("write failed for %s: %s", name, e)
        if os.path.exists(tmp): os.remove(tmp)
        return jsonify(error="storage error"), 507
    log.info("stored %s", name)
    return jsonify(ok=True), 201

@app.get("/files/<name>")
def get_file(name):
    guard(name)
    return send_from_directory(DATA_DIR, name, conditional=True)   # supports HTTP Range

@app.get("/healthz")
def healthz():
    return ("ok", 200) if os.access(DATA_DIR, os.W_OK) else ("storage not writable", 503)