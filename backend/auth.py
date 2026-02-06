from passlib.context import CryptContext
import sqlite3
from database import get_connection

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def hash_password(password: str) -> str:
    # bcrypt only uses first 72 bytes
    safe_password = password.encode("utf-8")[:72]
    return pwd_context.hash(safe_password)

def verify_password(password: str, password_hash: str) -> bool:
    safe_password = password.encode("utf-8")[:72]
    return pwd_context.verify(safe_password, password_hash)

def create_user(email: str, password: str):
    password_hash = hash_password(password)

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            INSERT INTO users (email, password_hash)
            VALUES (?, ?)
        """, (email, password_hash))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def authenticate_user(email: str, password:str):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        "SELECT id, password_hash FROM users WHERE email = ?",
        (email,)
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    user_id = row["id"]
    password_hash = row["password_hash"]

    if not verify_password(password, password_hash):
        return None

    return user_id


