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
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # ---- Findings table ----
    cur.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            upload_id INTEGER,
            category TEXT,
            issue TEXT,
            detail TEXT,
            severity TEXT,
            nist_reference TEXT,
            remediation TEXT,
            FOREIGN KEY (upload_id) REFERENCES uploads(id)
        )
    """)

    conn.commit()
    conn.close()


def save_upload(filename, raw_config, user_id):
    conn = get_connection()
    cur = conn.cursor()

    raw_config_json = json.dumps(raw_config)

    try:
        cur.execute("""
            INSERT INTO uploads (filename, raw_config, user_id)
            VALUES (?, ?, ?)
        """, (filename, raw_config_json, user_id))

        upload_id = cur.lastrowid
        conn.commit()
        return upload_id
    except Exception as e:
        print(f"Error saving upload: {e}")
        conn.rollback()
        return None
    finally:
        conn.close()

def save_findings(upload_id, findings):
    if not findings:
        return

    conn = get_connection()
    cur = conn.cursor()

    try:
        for f in findings:
            cur.execute("""
                INSERT INTO findings (
                    upload_id, category, issue, detail, severity, nist_reference, remediation
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            upload_id,
            f.get("category"),
            f.get("issue"),
            f.get("detail"),
            f.get("severity"),
            f.get("nist_reference"),
            f.get("remediation"),
        ))
        conn.commit()
    except Exception as e:
        print(f"Error saving findings: {e}")
        conn.rollback()
    finally:
        conn.close()

def get_user_uploads(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM uploads WHERE user_id = ? ORDER BY id DESC", (user_id,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

def get_findings_by_upload_id(upload_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM findings WHERE upload_id = ?", (upload_id,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return rows

   
