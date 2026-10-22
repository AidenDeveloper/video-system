import os
import mysql.connector

def secret(name, default=None):
    path = os.environ.get(f"{name}_FILE")
    if path:
        with open(path) as f:
            return f.read().strip()
    return os.environ.get(name, default)

def db():
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "mysql"), user=os.environ.get("DB_USER"),
        password=secret("DB_PASSWORD"), database=os.environ.get("DB_NAME"),
        connection_timeout=3)