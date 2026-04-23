from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, Header, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import get_settings
from app.database import get_db
from app.schemas import UserRole


JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 12


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def serialize_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name"),
        "role": user["role"],
        "business_id": user.get("business_id"),
        "business_name": user.get("business_name"),
        "saved_profile": user.get("saved_profile"),
    }


def create_access_token(
    *,
    user_id: str,
    email: str,
    name: str | None,
    role: str,
    business_id: str | None = None,
    business_name: str | None = None,
) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "role": role,
        "business_id": business_id,
        "business_name": business_name,
        "exp": datetime.now(UTC) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from error


async def _get_user_from_token(token: str) -> dict[str, Any]:
    payload = decode_access_token(token)

    try:
        user_id = ObjectId(payload["sub"])
    except (InvalidId, KeyError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from error

    db: AsyncIOMotorDatabase = get_db()
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return serialize_user(user)


async def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = authorization.replace("Bearer ", "", 1)
    return await _get_user_from_token(token)


async def get_optional_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any] | None:
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    token = authorization.replace("Bearer ", "", 1)
    return await _get_user_from_token(token)


async def get_optional_customer(
    current_user: dict[str, Any] | None = Depends(get_optional_current_user),
) -> dict[str, Any] | None:
    if not current_user or current_user["role"] != UserRole.CUSTOMER.value:
        return None
    return current_user


def require_roles(*roles: UserRole) -> Callable[..., Any]:
    role_values = {role.value for role in roles}

    async def dependency(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if role_values and current_user["role"] not in role_values:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this resource.")
        return current_user

    return dependency


get_current_portal_user = require_roles(UserRole.ADMIN, UserRole.BUSINESS)
get_current_customer = require_roles(UserRole.CUSTOMER)


def page_belongs_to_user(user: dict[str, Any], page: dict[str, Any]) -> bool:
    if user["role"] == UserRole.ADMIN.value:
        return True
    if user["role"] == UserRole.BUSINESS.value:
        return page.get("business_id") == user.get("business_id")
    return False
