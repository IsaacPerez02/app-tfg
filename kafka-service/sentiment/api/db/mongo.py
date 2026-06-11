import pymongo

from config import MONGO_COLLECTION, MONGO_DB, MONGO_URI


def get_collection() -> pymongo.collection.Collection:
    client = pymongo.MongoClient(MONGO_URI)
    col = client[MONGO_DB][MONGO_COLLECTION]
    col.create_index("date")
    col.create_index("tickers")
    col.create_index("sentiment.label")
    col.create_index("created_at")
    return col
