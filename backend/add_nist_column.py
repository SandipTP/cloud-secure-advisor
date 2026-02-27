import sqlite3

DB = "cloudscanner.db"

conn = sqlite3.connect(DB)
cur = conn.cursor()

# Verify table exists
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", tables)

# Add column only if missing
cols = cur.execute("PRAGMA table_info(finding)").fetchall()
col_names = {c[1] for c in cols}
print("Columns in finding:", col_names)

if "nist_reference" not in col_names:
    cur.execute("ALTER TABLE finding ADD COLUMN nist_reference TEXT")
    conn.commit()
    print("✅ Added nist_reference column to finding")
else:
    print("✅ nist_reference already exists (no change)")

conn.close()