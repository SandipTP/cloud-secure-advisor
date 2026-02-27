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

def authenticate_user(email: str, password: str):
    # Using 'with' automatically handles closing or cleaning up
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,))
        row = cur.fetchone()

    if row and verify_password(password, row["password_hash"]):
        return row["id"]
    
    return None


