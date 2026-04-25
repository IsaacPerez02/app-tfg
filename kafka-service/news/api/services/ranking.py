"""
Ranking helpers usados por la API al re-ordenar resultados de MongoDB.

El importance_score canónico lo escribe consumer_mongo en el momento del insert.
Este módulo añade una capa de recency decay + señal de sentimiento para que
el feed priorice artículos recientes e impactantes frente a artículos antiguos
con score alto almacenado.

Fórmula final:
    final_score = importance * 0.7 + abs(sentiment) * 0.2 + recency * 0.1
"""

import math
from datetime import datetime, timezone

from config import RECENCY_TAU_HOURS


def _parse_date(date_str: str) -> datetime | None:
    try:
        return datetime.strptime(date_str[:14], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def recency_decay(date_str: str, now: datetime | None = None, tau: float | None = None) -> float:
    """exp(-t/τ) donde t es horas desde publicación y τ = RECENCY_TAU_HOURS."""
    if now is None:
        now = datetime.now(timezone.utc)
    if tau is None:
        tau = RECENCY_TAU_HOURS
    dt = _parse_date(date_str)
    if dt is None:
        return 0.5
    hours_old = max(0, (now - dt).total_seconds() / 3600)
    return math.exp(-hours_old / tau)


def final_score(doc: dict, now: datetime) -> float:
    """
    Híbrido de importancia almacenada, magnitud de sentimiento y recency.
      70% importance_score  — calidad editorial / impacto financiero
      20% |sentiment|       — noticias neutras suben menos que las impactantes
      10% recency_decay     — penaliza artículos demasiado viejos
    """
    importance = float(doc.get("importance_score", 0.0))
    sentiment  = abs(float(doc.get("sentiment", 0.0)))
    recency    = recency_decay(doc.get("date", ""), now)
    return importance * 0.7 + sentiment * 0.2 + recency * 0.1


def compute_importance(doc: dict) -> float:
    """
    Importancia dinámica para re-ranking en la API.
    No sustituye importance_score almacenado; se usa al servir el feed.
      sentiment:   |sentiment| * 1.5  (max ~1.5)
      tickers:     nº tickers * 2.0   (cap 6.0)
      entities:    (persons + orgs) * 0.5  (cap 3.0)
      × recency:   decay agresivo τ=24h
    """
    now = datetime.now(timezone.utc)
    sentiment  = abs(float(doc.get("sentiment", 0))) * 1.5
    tickers    = min(len(doc.get("tickers", [])) * 2.0, 6.0)
    entities   = min((len(doc.get("persons", [])) + len(doc.get("organizations", []))) * 0.5, 3.0)
    recency    = recency_decay(doc.get("date", ""), now, tau=24.0)
    return round((sentiment + tickers + entities) * recency, 4)


def compute_trending(doc: dict) -> float:
    """
    Puntuación de trending: recency agresiva (τ=24h) dominante + señal sentimiento.
    """
    now     = datetime.now(timezone.utc)
    recency  = recency_decay(doc.get("date", ""), now, tau=24.0)
    sentiment = abs(float(doc.get("sentiment", 0)))
    return round(recency * 0.7 + sentiment * 0.3, 4)


def sort_by_score(docs: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc)
    return sorted(docs, key=lambda d: final_score(d, now), reverse=True)
