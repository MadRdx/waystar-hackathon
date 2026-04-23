from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING

from app.config import get_settings


class MongoState:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo_state = MongoState()


async def connect_to_database() -> None:
    settings = get_settings()
    mongo_state.client = AsyncIOMotorClient(settings.mongodb_uri)
    mongo_state.db = mongo_state.client[settings.mongodb_db_name]
    await mongo_state.db.command("ping")

    await mongo_state.db.users.create_index([("email", ASCENDING)], unique=True)
    await mongo_state.db.users.create_index([("role", ASCENDING)])
    await mongo_state.db.users.create_index([("business_id", ASCENDING)])
    await mongo_state.db.payment_pages.create_index([("slug", ASCENDING)], unique=True)
    await mongo_state.db.payment_pages.create_index([("business_id", ASCENDING)])
    await mongo_state.db.transactions.create_index([("public_id", ASCENDING)], unique=True)
    await mongo_state.db.transactions.create_index([("page_id", ASCENDING), ("created_at", ASCENDING)])
    await mongo_state.db.transactions.create_index([("business_id", ASCENDING), ("created_at", ASCENDING)])
    await mongo_state.db.transactions.create_index([("customer_id", ASCENDING), ("created_at", ASCENDING)])
    await mongo_state.db.email_logs.create_index([("business_id", ASCENDING), ("created_at", ASCENDING)])
    await mongo_state.db.email_logs.create_index([("created_at", ASCENDING)])


async def close_database_connection() -> None:
    if mongo_state.client is not None:
        mongo_state.client.close()
        mongo_state.client = None
        mongo_state.db = None


def get_db() -> AsyncIOMotorDatabase:
    if mongo_state.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return mongo_state.db
