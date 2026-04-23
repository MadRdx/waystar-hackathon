from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.schemas import CustomerRegisterPayload, LoginPayload, UserRole
from app.security import create_access_token, get_current_user, hash_password, verify_password
from app.serializers import serialize_user
from app.utils import now_utc


router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: dict) -> dict:
    return {
        "token": create_access_token(
            user_id=str(user["_id"]),
            email=user["email"],
            name=user.get("name"),
            role=user["role"],
            business_id=user.get("business_id"),
            business_name=user.get("business_name"),
        ),
        "user": serialize_user(user),
    }


@router.post("/login")
async def login(payload: LoginPayload) -> dict:
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower()})

    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    if payload.expected_role and user["role"] != payload.expected_role.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account does not have access to that portal.",
        )

    return _token_response(user)


@router.post("/customer/register", status_code=status.HTTP_201_CREATED)
async def register_customer(payload: CustomerRegisterPayload) -> dict:
    db = get_db()
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That email address is already registered.")

    timestamp = now_utc()
    document = {
        "email": payload.email.lower(),
        "name": payload.name.strip(),
        "role": UserRole.CUSTOMER.value,
        "password_hash": hash_password(payload.password),
        "business_id": None,
        "business_name": None,
        "saved_profile": {
            "payer_name": payload.name.strip(),
            "billing_zip": payload.billing_zip.strip() if payload.billing_zip else None,
        },
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    result = await db.users.insert_one(document)
    created = await db.users.find_one({"_id": result.inserted_id})
    return _token_response(created)


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {"user": current_user}
