import os

KAFKA_BROKER      = os.getenv("KAFKA_BROKER", "localhost:9092")
KAFKA_INPUT_TOPIC = os.getenv("KAFKA_INPUT_TOPIC", "enriched_news")

MONGO_URI        = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB         = os.getenv("MONGO_DB", "sentiment")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "sentiment_news")

MODEL_PATH = os.getenv("MODEL_PATH", "/app/finbert-aapl-cls")

# Thermometer historical data
THERMOMETER_PARQUET = os.getenv("THERMOMETER_PARQUET", "/app/aapl_thermometer_daily.parquet")
