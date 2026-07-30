#!/usr/bin/env python3
"""
Builds data/tracker.db from db/schema.sql + db/seed.sql.

Run this whenever you edit schema.sql or seed.sql, then commit the
regenerated data/tracker.db alongside your change:

    python3 db/build_db.py
"""
import sqlite3
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "tracker.db"
SCHEMA_PATH = ROOT / "db" / "schema.sql"
SEED_PATH = ROOT / "db" / "seed.sql"

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
if DB_PATH.exists():
    DB_PATH.unlink()

conn = sqlite3.connect(DB_PATH)
conn.executescript(SCHEMA_PATH.read_text())
conn.executescript(SEED_PATH.read_text())
conn.commit()
conn.close()

print(f"Built {DB_PATH} ({DB_PATH.stat().st_size} bytes)")
