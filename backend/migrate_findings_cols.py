import sqlite3

DB = "cloudscanner.db"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cols = cur.execute("PRAGMA table_info(findings)").fetchall()
names = {c[1] for c in cols}
print("Existing columns:", names)

if "nist_reference" not in names:
    cur.execute("ALTER TABLE findings ADD COLUMN nist_reference TEXT")
    print("✅ Added nist_reference")

if "remediation" not in names:
    cur.execute("ALTER TABLE findings ADD COLUMN remediation TEXT")
    print("✅ Added remediation")

conn.commit()
conn.close()
print("✅ Migration done.")