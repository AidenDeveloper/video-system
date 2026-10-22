import os, sys, datetime
os.environ.update(JWT_SECRET="test-secret", DB_HOST="127.0.0.1", DB_USER="x", DB_PASSWORD="x", DB_NAME="x")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import jwt
from app import app

def client(): return app.test_client()

def tok(exp=60, role="viewer"):
    e = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=exp)
    return jwt.encode({"sub": "bob", "role": role, "exp": e}, "test-secret", algorithm="HS256")

def test_verify_requires_token():
    assert client().get("/verify").status_code == 401

def test_verify_ok():
    c = client(); c.set_cookie("token", tok())
    r = c.get("/verify"); assert r.status_code == 200 and r.json["role"] == "viewer"

def test_verify_expired():
    c = client(); c.set_cookie("token", tok(exp=-10))
    assert c.get("/verify").status_code == 401

def test_login_rejects_injection_username():
    assert client().post("/login", json={"username": "a' OR 1=1--", "password": "x"}).status_code == 400

def test_health_503_without_db():
    assert client().get("/healthz").status_code == 503