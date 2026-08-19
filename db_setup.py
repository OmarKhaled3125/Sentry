import sqlite3
import json

def initialize_database(db_path: str = "forensics_traces.db") -> None:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS spans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trace_id TEXT NOT NULL,
            span_id TEXT NOT NULL,
            parent_span_id TEXT,
            name TEXT NOT NULL,
            start_time INTEGER,
            end_time INTEGER,
            attributes TEXT,
            status_code TEXT,
            status_description TEXT
        )
    ''')
    conn.commit()
    conn.close()


if __name__ == "__main__":
    initialize_database()
    print("Database initialized successfully.")