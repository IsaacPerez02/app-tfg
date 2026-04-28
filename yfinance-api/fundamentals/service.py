from datetime import datetime, timezone

from .storage import read_fundamentals, write_fundamentals
from .downloader import fetch_fundamentals
from .config import MAX_AGE_SECONDS

# ==============================
# STALENESS CHECK
# ==============================
def _is_stale(updated_at: str) -> bool:
    try:
        last = datetime.fromisoformat(updated_at)
        now = datetime.now(timezone.utc)
        return (now - last).total_seconds() > MAX_AGE_SECONDS
    except Exception:
        return True

# ==============================
# SERVICE ENTRYPOINT
# ==============================
def get_fundamentals(ticker: str):
    cached = read_fundamentals(ticker)

    # ❌ no existe → descargar
    if not cached:
        data = fetch_fundamentals(ticker)
        write_fundamentals(ticker, data)
        return data

    updated_at = cached.get("updated_at")

    # ⏳ stale → refrescar
    if not updated_at or _is_stale(updated_at):
        data = fetch_fundamentals(ticker)
        write_fundamentals(ticker, data)
        return data

    # ✔ cache válido
    return cached["data"]