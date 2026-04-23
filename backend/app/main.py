from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_database_connection, connect_to_database
from app.routers import auth, customers, payment_pages, payments, reports


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_database()
    yield
    await close_database_connection()


settings = get_settings()
app = FastAPI(
    title="Quick Payment Pages API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(payment_pages.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")


@app.get("/health")
async def healthcheck() -> dict:
    return {"status": "ok"}
