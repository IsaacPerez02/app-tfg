"""
GDELT GKG ingestion pipeline.

Flow:
  GDELT masterfile → últimos MAX_FILES archivos GKG (orden DESC)
  → per-file: filtro de recencia estricto (3 días)
              + FINANCIAL_THEMES + match NASDAQ tickers
              + límite MAX_ROWS_PER_FILE
  → publish RawNews to Kafka raw_news topic
"""

import io
import json
import logging
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone

import requests
from confluent_kafka import Producer

from config import (
    KAFKA_BROKER,
    RAW_TOPIC,
    is_financial,
    match_tickers,
    normalize_sentiment,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

MASTER_URL       = "http://data.gdeltproject.org/gdeltv2/masterfilelist.txt"
MAX_FILES        = 20          # solo los N archivos más recientes del masterfile
MAX_ROWS_PER_FILE = 200        # filas útiles máximas por archivo
RECENCY_DAYS     = 3           # solo artículos de los últimos N días


def _build_producer() -> Producer:
    return Producer({
        "bootstrap.servers": KAFKA_BROKER,
        "retries": 3,
        "acks": "all",
    })


def get_gkg_urls() -> list[str]:
    """
    Descarga el masterfile, extrae URLs de archivos GKG y las devuelve
    ordenadas de más reciente a más antigua, limitadas a MAX_FILES.
    """
    log.info("Fetching GDELT masterfile…")
    entries: list[tuple[datetime, str]] = []

    for line in requests.get(MASTER_URL, timeout=30).text.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        url = parts[2]
        if "gkg.csv.zip" not in url:
            continue
        try:
            ts = url.split("/")[-1][:14]
            dt = datetime.strptime(ts, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
            entries.append((dt, url))
        except ValueError:
            continue

    # MÁS RECIENTES PRIMERO
    entries.sort(key=lambda x: x[0], reverse=True)
    urls = [u for _, u in entries[:MAX_FILES]]

    log.info("Selected %d most-recent GKG files (out of %d)", len(urls), len(entries))
    return urls


def _is_recent(date_str: str) -> bool:
    """True si el artículo tiene menos de RECENCY_DAYS días."""
    try:
        dt = datetime.strptime(date_str[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) - dt <= timedelta(days=RECENCY_DAYS)
    except (ValueError, TypeError):
        return False


def process_file(url: str, producer: Producer) -> int:
    """Descarga un zip GKG, filtra filas y publica las relevantes. Retorna el nº publicado."""
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
    except requests.RequestException as e:
        log.warning("Failed to fetch %s: %s", url, e)
        return 0

    published = 0
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        with z.open(z.namelist()[0]) as f:
            for raw_line in f:
                if published >= MAX_ROWS_PER_FILE:
                    break
                try:
                    cols = raw_line.decode("utf-8", errors="ignore").split("\t")
                    if len(cols) < 16:
                        continue

                    # Filtro de recencia estricto (3 días)
                    if not _is_recent(cols[1]):
                        continue

                    themes = cols[7]
                    if not is_financial(themes):
                        continue

                    orgs = cols[13]
                    tickers = match_tickers(orgs)
                    if not tickers:
                        continue

                    persons_raw = cols[11]
                    persons = [p.strip() for p in persons_raw.split(";") if p.strip()] if persons_raw else []

                    item = {
                        "date": cols[1],
                        "url": cols[4],
                        "source": cols[3],
                        "tickers": tickers,
                        "persons": persons[:10],
                        "organizations": [o.strip() for o in orgs.split(";") if o.strip()][:10],
                        "tags": [t.split(",")[0] for t in themes.split(";") if t][:15],
                        "sentiment": normalize_sentiment(cols[15]),
                    }

                    producer.produce(RAW_TOPIC, value=json.dumps(item).encode("utf-8"))
                    producer.poll(0)
                    published += 1

                except Exception:
                    continue

    return published


def run() -> None:
    producer = _build_producer()
    urls     = get_gkg_urls()
    total    = 0

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(process_file, url, producer): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                n = future.result()
                total += n
                log.info("✔ %s → %d items", url.split("/")[-1], n)
            except Exception as e:
                log.error("Error processing %s: %s", url, e)

    producer.flush()
    log.info("Done. Published %d raw news items to '%s'", total, RAW_TOPIC)


if __name__ == "__main__":
    run()
