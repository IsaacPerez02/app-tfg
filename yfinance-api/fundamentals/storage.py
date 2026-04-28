import os
import json
from datetime import datetime
from typing import Optional

import pandas as pd

from .config import DATA_DIR

# ==============================
# PATH
# ==============================
def file_path(ticker: str) -> str:
    return os.path.join(DATA_DIR, f"{ticker}.json")

# ==============================
# READ
# ==============================
def read_fundamentals(ticker: str) -> Optional[dict]:
    path = file_path(ticker)

    try:
        if not os.path.exists(path):
            return None

        with open(path, "r") as f:
            return json.load(f)

    except Exception:
        return None

# ==============================
# SANITIZER
# ==============================
def _sanitize(obj):
    """
    Convierte objetos no serializables a JSON-safe
    """
    if isinstance(obj, dict):
        return {
            str(k) if isinstance(k, (pd.Timestamp, datetime)) else k: _sanitize(v)
            for k, v in obj.items()
        }

    if isinstance(obj, list):
        return [_sanitize(x) for x in obj]

    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()

    if isinstance(obj, datetime):
        return obj.isoformat()

    return obj

# ==============================
# WRITE
# ==============================
def write_fundamentals(ticker: str, data: dict):
    path = file_path(ticker)

    payload = {
        "updated_at": datetime.utcnow().isoformat(),
        "data": _sanitize(data)
    }

    with open(path, "w") as f:
        json.dump(payload, f, indent=2)