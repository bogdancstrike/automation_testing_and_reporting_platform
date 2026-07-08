from src.core.db import engine
from sqlalchemy import text

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE test_run_steps ADD COLUMN timings JSONB DEFAULT '{}'::jsonb;"))
        print("Column timings added to test_run_steps.")
    except Exception as e:
        print("Maybe column already exists or error:", e)
