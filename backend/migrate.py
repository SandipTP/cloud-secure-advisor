import sqlite3

def run_migration():
    conn = sqlite3.connect("cloudscanner.db")
    cur = conn.cursor()
    
    print("Patching database...")
    try:
        # 1. Add the missing user_id column
        cur.execute("ALTER TABLE uploads ADD COLUMN user_id INTEGER REFERENCES users(id)")
        
        # 2. (Optional) Set a default user_id for existing rows 
        # so they aren't orphaned (replace '1' with your actual first user ID)
        cur.execute("UPDATE uploads SET user_id = 1 WHERE user_id IS NULL")
        
        conn.commit()
        print("Success! user_id column added to 'uploads' table.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Migration skipped: user_id column already exists.")
        else:
            print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()