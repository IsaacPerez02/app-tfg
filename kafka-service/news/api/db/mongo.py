"""
Async MongoDB client (motor) shared by the FastAPI app.

Usage in FastAPI:
    from db.mongo import get_collection, create_indexes

    @app.on_event("startup")
    async def startup():
        await create_indexes()

    collection = get_collection()
"""

import motor.motor_asyncio

from config import MONGO_COLLECTION, MONGO_DB, MONGO_URI

_client: motor.motor_asyncio.AsyncIOMotorClient | None = None


def _get_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    return _client


def get_collection() -> motor.motor_asyncio.AsyncIOMotorCollection:
    return _get_client()[MONGO_DB][MONGO_COLLECTION]


async def create_indexes() -> None:
    col = get_collection()
    await col.create_index("date")
    await col.create_index("tickers")
    await col.create_index("sentiment")
    await col.create_index("importance_score")
    await col.create_index("created_at")
    # _id is already indexed (it stores hash(url))
