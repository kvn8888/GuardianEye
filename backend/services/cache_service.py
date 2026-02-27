"""Cache service — SQLite-backed result cache for scan analysis.

Stores analysis results keyed by content hash so repeated scans of
identical content return instantly (while still showing the animation).

Supports:
  - Local SQLite (default, zero config)
  - Turso/libSQL remote (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env)
"""
import os
import json
import hashlib
import sqlite3
import time
from pathlib import Path
from typing import Optional

# Try libsql for Turso support
try:
    import libsql_experimental as libsql  # type: ignore
    HAS_LIBSQL = True
except ImportError:
    HAS_LIBSQL = False

_conn = None
DB_PATH = Path(__file__).parent.parent / "cache.db"


def _get_conn():
    """Get or create a database connection (local SQLite or Turso)."""
    global _conn
    if _conn is not None:
        return _conn

    turso_url = os.getenv("TURSO_DATABASE_URL")
    turso_token = os.getenv("TURSO_AUTH_TOKEN")

    if turso_url and turso_token and HAS_LIBSQL:
        # Turso remote DB with local replica for speed
        _conn = libsql.connect(
            str(DB_PATH),
            sync_url=turso_url,
            auth_token=turso_token,
        )
        _conn.sync()
        print(f"✓ Cache: Turso sync @ {turso_url}")
    else:
        # Pure local SQLite
        _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        print(f"✓ Cache: local SQLite @ {DB_PATH}")

    _conn.execute("PRAGMA journal_mode=WAL")
    _create_tables(_conn)
    return _conn


def _create_tables(conn):
    """Create cache tables if they don't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scan_cache (
            content_hash TEXT PRIMARY KEY,
            scan_type TEXT NOT NULL,
            input_preview TEXT,
            result JSON NOT NULL,
            sse_events JSON,
            created_at REAL NOT NULL,
            hit_count INTEGER DEFAULT 0,
            last_hit_at REAL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_cache_type
        ON scan_cache(scan_type, created_at DESC)
    """)
    # Scan persistence — survives server restarts
    conn.execute("""
        CREATE TABLE IF NOT EXISTS completed_scans (
            scan_id TEXT PRIMARY KEY,
            scan_type TEXT NOT NULL,
            result JSON NOT NULL,
            created_at REAL NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_scans_created
        ON completed_scans(created_at DESC)
    """)
    conn.commit()


# ── Hashing ─────────────────────────────────────────────────

def hash_text(text: str) -> str:
    """Deterministic hash for text content."""
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()[:32]


def hash_file(file_path: str) -> str:
    """Deterministic hash for file content."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:32]


def hash_image_bytes(data: bytes) -> str:
    """Hash raw image bytes (for uploaded files before saving)."""
    return hashlib.sha256(data).hexdigest()[:32]


# ── Read ─────────────────────────────────────────────────────

def get_cached(content_hash: str) -> Optional[dict]:
    """Look up a cached scan result. Returns None on miss."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT result, sse_events FROM scan_cache WHERE content_hash = ?",
        (content_hash,),
    ).fetchone()
    if not row:
        return None

    # Update hit stats
    conn.execute(
        "UPDATE scan_cache SET hit_count = hit_count + 1, last_hit_at = ? WHERE content_hash = ?",
        (time.time(), content_hash),
    )
    conn.commit()

    return {
        "result": json.loads(row[0]),
        "sse_events": json.loads(row[1]) if row[1] else None,
    }


# ── Write ────────────────────────────────────────────────────

def store_result(
    content_hash: str,
    scan_type: str,
    result: dict,
    sse_events: list[dict] | None = None,
    input_preview: str = "",
) -> None:
    """Store a scan result in the cache."""
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO scan_cache
           (content_hash, scan_type, input_preview, result, sse_events, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            content_hash,
            scan_type,
            input_preview[:200],
            json.dumps(result),
            json.dumps(sse_events) if sse_events else None,
            time.time(),
        ),
    )
    conn.commit()

    # Sync to Turso if connected
    if HAS_LIBSQL and os.getenv("TURSO_DATABASE_URL"):
        try:
            conn.sync()
        except Exception:
            pass  # Non-critical


# ── Stats ────────────────────────────────────────────────────

def cache_stats() -> dict:
    """Return cache statistics."""
    conn = _get_conn()
    total = conn.execute("SELECT COUNT(*) FROM scan_cache").fetchone()[0]
    hits = conn.execute("SELECT SUM(hit_count) FROM scan_cache").fetchone()[0] or 0
    by_type = {}
    rows = conn.execute("SELECT scan_type, COUNT(*) FROM scan_cache GROUP BY scan_type").fetchall()
    for row in rows:
        by_type[row[0]] = row[1]
    return {"total_entries": total, "total_hits": hits, "by_type": by_type}


def clear_cache() -> int:
    """Clear all cached results. Returns count of deleted entries."""
    conn = _get_conn()
    count = conn.execute("SELECT COUNT(*) FROM scan_cache").fetchone()[0]
    conn.execute("DELETE FROM scan_cache")
    conn.commit()
    return count


# ── Scan Persistence ─────────────────────────────────────────

def save_scan(scan_id: str, scan_type: str, result: dict) -> None:
    """Persist a completed scan so it survives server restarts."""
    conn = _get_conn()
    conn.execute(
        """INSERT OR REPLACE INTO completed_scans
           (scan_id, scan_type, result, created_at) VALUES (?, ?, ?, ?)""",
        (scan_id, scan_type, json.dumps(result), time.time()),
    )
    conn.commit()
    if HAS_LIBSQL and os.getenv("TURSO_DATABASE_URL"):
        try:
            conn.sync()
        except Exception:
            pass


def get_scan(scan_id: str) -> Optional[dict]:
    """Load a scan from the persistence layer."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT result FROM completed_scans WHERE scan_id = ?",
        (scan_id,),
    ).fetchone()
    if not row:
        return None
    return json.loads(row[0])


def list_saved_scans(limit: int = 50) -> list[dict]:
    """List all persisted scans, most recent first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT scan_id, scan_type, result, created_at FROM completed_scans ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ).fetchall()
    scans = []
    for row in rows:
        result = json.loads(row[2])
        result["scan_id"] = row[0]
        result["type"] = row[1]
        scans.append(result)
    return scans
