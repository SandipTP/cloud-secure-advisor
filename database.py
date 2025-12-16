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

    # Create uploads table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            timestamp TEXT,
            raw_config TEXT
        )
    """)

    # Create findings table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER,
            type TEXT,
            issue TEXT,
            detail TEXT,
            severity TEXT,
            nist_reference TEXT,
            FOREIGN KEY(upload_id) REFERENCES uploads(id)
        )
    """)

    conn.commit()
    conn.close()

def save_upload(filename, raw_config):
    conn = get_connection()
    cur = conn.cursor()

    timestamp = datetime.utcnow().isoformat()
    raw_config_json = json.dumps(raw_config)

    cur.execute("""
        INSERT INTO uploads (filename, timestamp, raw_config)
        VALUES (?, ?, ?)
    """, (filename, timestamp, raw_config_json))

    upload_id = cur.lastrowid
    conn.commit()
    conn.close()

    return upload_id

def save_findings(upload_id, findings):
    conn = get_connection()
    cur = conn.cursor()

    for f in findings:
        cur.execute("""
            INSERT INTO findings (upload_id, type, issue, detail, severity, nist_reference)
            VALUES (?, ?, ?, ?, ?, ?)
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
