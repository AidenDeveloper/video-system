import os, re, logging, datetime
import jwt
from flask import Flask, request, jsonify, make_response
from werkzeug.security import check_password_hash
from common import db, secret

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"),
                    format="%(asctime)s %(levelname)s auth: %(message)s")
log = logging.getLogger("auth")
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4096
JWT_SECRET = secret("JWT_SECRET")
USER_RE = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"

LOGIN_HTML = """<!doctype html><title>Login</title><h1>Login</h1>
<input id=u placeholder=username><input id=p type=password placeholder=password>
<button onclick=go()>Login</button><p id=m></p>
<script>async function go(){
 const r=await fetch('/login',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({username:u.value,password:p.value})});
 if(r.ok){const j=await r.json();location=j.role==='uploader'?'/upload':'/videos'}
 else m.textContent='Login failed ('+r.status+')'}</script>"""

@app.get("/login")
def login_page():
    return LOGIN_HTML

@app.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username, password = str(data.get("username", "")), str(data.get("password", ""))
    if not USER_RE.match(username) or not (1 <= len(password) <= 128):
        return jsonify(error="invalid input"), 400
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT password_hash, role FROM users WHERE username=%s", (username,))
        row = cur.fetchone(); conn.close()
    except Exception as e:
        log.error("database error during login: %s", type(e).__name__)
        return jsonify(error="service unavailable"), 503
    if not row or not check_password_hash(row["password_hash"], password):
        log.warning("login failed user=%s", username)
        return jsonify(error="invalid credentials"), 401
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    token = jwt.encode({"sub": username, "role": row["role"], "exp": exp}, JWT_SECRET, algorithm="HS256")
    resp = make_response(jsonify(ok=True, role=row["role"]))
    resp.set_cookie("token", token, httponly=True, samesite="Strict", secure=COOKIE_SECURE, max_age=3600)
    log.info("login ok user=%s", username)
    return resp

@app.get("/verify")
def verify():
    try:
        c = jwt.decode(request.cookies.get("token", ""), JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return jsonify(error="unauthorized"), 401
    return jsonify(user=c["sub"], role=c["role"])

@app.get("/logout")
def logout():
    resp = make_response("", 302); resp.headers["Location"] = "/login"
    resp.delete_cookie("token"); return resp

@app.get("/healthz")
def healthz():
    try:
        db().close(); return "ok"
    except Exception:
        return "database unavailable", 503