"""Durable scan storage.

Local JSON files under data/ are always written (fast, works offline). When ACHILLES_MONGODB_URI is set,
every scan and every tips result is also upserted into MongoDB (e.g. Atlas), so history survives a new VM,
a wiped disk, or several scanner instances sharing one database.

- Writes to MongoDB go through a single background thread: the event loop never waits on the network,
  and writes for one scan stay in order.
- If MongoDB is unreachable at startup the scanner logs a warning and keeps running on files only.
- Secrets never reach the database unmasked: findings are already masked by the scanner.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

from .config import settings
from .models import ScanResult

log = logging.getLogger("achilles.store")


class MongoStore:
    def __init__(self, uri: str, db_name: str) -> None:
        from pymongo import ASCENDING, DESCENDING, MongoClient  # imported lazily: optional dependency

        self.client = MongoClient(uri, serverSelectionTimeoutMS=6000, appname="achilles-scanner")
        self.client.admin.command("ping")  # fail fast if the URI, credentials or IP access list are wrong
        db = self.client[db_name]
        self.scans = db["scans"]
        self.tips = db["tips"]
        self.scans.create_index([("target.host", ASCENDING), ("created_at", DESCENDING)])
        self.scans.create_index([("created_at", DESCENDING)])
        self._writer = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mongo-writer")

    # --- scans -----------------------------------------------------------------
    def save_scan(self, s: ScanResult) -> None:
        doc = {"_id": s.scan_id, **s.model_dump(mode="json")}
        self._writer.submit(self._upsert, self.scans, doc)

    def load_recent(self, limit: int) -> list[ScanResult]:
        out = []
        for d in self.scans.find({}, sort=[("created_at", -1)], limit=limit):
            s = _parse(d)
            if s:
                out.append(s)
        return out

    def get_scan(self, scan_id: str) -> Optional[ScanResult]:
        return _parse(self.scans.find_one({"_id": scan_id}))

    def host_scans(self, host: str, limit: int) -> list[ScanResult]:
        cur = self.scans.find({"target.host": host}, sort=[("created_at", -1)], limit=limit)
        return [s for s in (_parse(d) for d in cur) if s]

    # --- tips --------------------------------------------------------------------
    def get_tips(self, scan_id: str) -> Optional[dict[str, Any]]:
        d = self.tips.find_one({"_id": scan_id})
        if d:
            d.pop("_id", None)
        return d

    def save_tips(self, scan_id: str, res: dict[str, Any]) -> None:
        self._writer.submit(self._upsert, self.tips, {"_id": scan_id, **res})

    # --- internals ---------------------------------------------------------------
    @staticmethod
    def _upsert(coll, doc: dict) -> None:
        try:
            coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)
        except Exception as e:  # never let a database hiccup break a scan
            log.warning("mongo write to %s failed for %s: %s", coll.name, doc.get("_id"), e)

    def flush(self, timeout: float = 10) -> None:
        """Wait for queued writes (used at shutdown and in tests)."""
        self._writer.submit(lambda: None).result(timeout=timeout)

    def close(self) -> None:
        try:
            self.flush()
        finally:
            self._writer.shutdown(wait=True)
            self.client.close()


def _parse(d: Optional[dict]) -> Optional[ScanResult]:
    if not d:
        return None
    d = dict(d)
    d.pop("_id", None)
    try:
        return ScanResult.model_validate(d)
    except Exception as e:
        log.warning("skipping unreadable scan document: %s", e)
        return None


def connect() -> Optional[MongoStore]:
    if not settings.mongodb_uri:
        return None
    try:
        store = MongoStore(settings.mongodb_uri, settings.mongodb_db)
    except ImportError:
        log.warning("ACHILLES_MONGODB_URI is set but pymongo is not installed; using local files only")
        return None
    except Exception as e:
        # Don't print the URI: it contains the database password.
        log.warning("could not reach MongoDB (%s); using local files only", type(e).__name__)
        return None
    log.info("scan history stored in MongoDB database %r", settings.mongodb_db)
    return store
