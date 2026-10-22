import sys, re, getpass
from werkzeug.security import generate_password_hash
from common import db, secret

USER_RE = re.compile(r"^[A-Za-z0-9_.-]{3,50}$")

def add_user(username, password, role):
    assert USER_RE.match(username), "bad username"
    assert role in ("uploader", "viewer"), "bad role"
    assert 8 <= len(password) <= 128, "password must be 8-128 chars"
    conn = db(); cur = conn.cursor()
    cur.execute("INSERT IGNORE INTO users (username, password_hash, role) VALUES (%s,%s,%s)",
                (username, generate_password_hash(password), role))
    conn.commit(); conn.close()

if __name__ == "__main__":
    if sys.argv[1] == "seed":
        add_user("admin", secret("ADMIN_PASSWORD"), "uploader")
    elif sys.argv[1] == "adduser":   # python manage.py adduser <name> <uploader|viewer>
        add_user(sys.argv[2], getpass.getpass("Password: "), sys.argv[3])