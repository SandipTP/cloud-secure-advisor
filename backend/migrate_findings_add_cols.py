import sqlite3

DB = "cloudscanner.db"
conn = sqlite3.connect(DB)
cur = conn.cursor()

cols = cur.execute("PRAGMA table_info(findings)").fetchall()
names = {c[1] for c in cols}
print("Existing findings columns:", names)

def add_col(name, coltype="TEXT"):
    if name not in names:
        cur.execute(f"ALTER TABLE findings ADD COLUMN {name} {coltype}")
        print(f"✅ Added column: {name}")
    else:
        print(f"↪ Column already exists: {name}")

add_col("category", "TEXT")
add_col("nist_reference", "TEXT")
add_col("remediation", "TEXT")

conn.commit()
conn.close()
print("✅ Done.")