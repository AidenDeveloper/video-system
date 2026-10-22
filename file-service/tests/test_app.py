import os, sys, tempfile
os.environ.update(DATA_DIR=tempfile.mkdtemp(), INTERNAL_API_KEY="k")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app import app
c = app.test_client()
NAME = "123e4567-e89b-12d3-a456-426614174000.mp4"
H = {"X-API-Key": "k"}

def test_requires_key():
    assert c.get(f"/files/{NAME}").status_code == 401

def test_roundtrip_and_range():
    assert c.put(f"/files/{NAME}", data=b"0123456789", headers=H).status_code == 201
    r = c.get(f"/files/{NAME}", headers={**H, "Range": "bytes=2-4"})
    assert r.status_code == 206 and r.data == b"234"

def test_rejects_bad_names():
    assert c.put("/files/..%2Fetc%2Fpasswd", data=b"x", headers=H).status_code in (400, 404)
    assert c.put("/files/evil.exe", data=b"x", headers=H).status_code == 400