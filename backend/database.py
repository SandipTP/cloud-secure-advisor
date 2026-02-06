import sqlite3
import json
from datetime import datetime

DB_NAME = "cloudscanner.db"


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db():
    conn = get_connection()
    cur = conn.cursor()

    # ---- Users table ----
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ---- Uploads table ----
    cur.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            raw_config TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # ---- Findings table ----
    cur.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER,
            type TEXT,
            issue TEXT,
            detail TEXT,
            severity TEXT,
            nist_reference TEXT,
            FOREIGN KEY (upload_id) REFERENCES uploads(id)
        )
    """)

    conn.commit()
    conn.close()


def save_upload(filename, raw_config, user_id):
    conn = get_connection()
    cur = conn.cursor()

    raw_config_json = json.dumps(raw_config)

    cur.execute("""
        INSERT INTO uploads (filename, raw_config, user_id)
        VALUES (?, ?, ?)
    """, (filename, raw_config_json, user_id))

    upload_id = cur.lastrowid
    conn.commit()
    conn.close()

    return upload_id


def save_findings(upload_id, findings):
    if not findings:
        return

    conn = get_connection()
    cur = conn.cursor()

    for f in findings:
        cur.execute("""
            INSERT INTO findings (
                upload_id, type, issue, detail, severity, nist_reference
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            upload_id,
            f["type"],
            f["issue"],
            f["detail"],
            f["severity"],
            f["nist_reference"]
        ))

    conn.commit()
    conn.close()
