import os

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
RAW_TOPIC = "raw_news"
ENRICHED_TOPIC = "enriched_news"

# Ranking decay half-life in hours (importance halves every TAU_HOURS)
RECENCY_TAU_HOURS = 24

# GDELT GKG theme prefixes that indicate financial relevance
FINANCIAL_THEMES = {
    "ECON_STOCKMARKET", "ECON_TRADE", "ECON_INFLATION", "ECON_BANKRUPTCY",
    "ECON_DEBTCRISIS", "ECON_CREDITRATING", "ECON_TAXATION", "ECON_INTEREST",
    "ECONOMY", "MARKET_CRASH", "UNGP_FINANCE_CORP", "ECON_CURRENCY",
    "ECON_HOUSING", "ECON_REMITTANCE", "ECON_FOREIGNINVEST",
}

# Maps lowercase org name fragments (as they appear in GDELT) → NASDAQ ticker
NASDAQ_MAP: dict[str, str] = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "intel": "INTC",
    "alphabet": "GOOGL",
    "google": "GOOGL",
    "netflix": "NFLX",
}


def match_tickers(orgs_raw: str) -> list[str]:
    """Match org names from GDELT against NASDAQ_MAP via substring lookup."""
    if not orgs_raw:
        return []
    orgs_lower = orgs_raw.lower()
    return sorted({ticker for name, ticker in NASDAQ_MAP.items() if name in orgs_lower})


def is_financial(themes_raw: str) -> bool:
    """Return True if any FINANCIAL_THEMES token appears in the themes field."""
    if not themes_raw:
        return False
    tokens = {t.split(",")[0] for t in themes_raw.split(";")}
    return bool(tokens & FINANCIAL_THEMES)


def normalize_sentiment(tone_raw: str) -> float:
    """Normalise GDELT V2Tone (first CSV field) to [-1, 1]."""
    try:
        return max(-1.0, min(1.0, float(tone_raw.split(",")[0]) / 10.0))
    except Exception:
        return 0.0
