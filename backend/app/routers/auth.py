from fastapi import APIRouter, Depends, HTTPException, status

from app.config import get_settings
from app.database import get_db
from app.schemas import CustomerRegisterPayload, GoogleOAuthPayload, LoginPayload, UserRole
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


@router.post("/oauth/google")
async def google_oauth(payload: GoogleOAuthPayload) -> dict:
    import httpx

    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth is not configured on this server.",
        )

    # Exchange authorization code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": payload.code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": payload.redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed. Please try again.",
        )

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google did not return an access token.",
        )

    # Fetch user profile from Google
    async with httpx.AsyncClient() as client:
        profile_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if profile_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to fetch your Google profile.",
        )

    google_profile = profile_response.json()
    google_email = google_profile.get("email", "").lower().strip()
    google_name = google_profile.get("name", "").strip() or google_email.split("@")[0]

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not provide an email address.",
        )

    # Find or create user
    db = get_db()
    user = await db.users.find_one({"email": google_email})

    if not user:
        # Auto-create as CUSTOMER
        timestamp = now_utc()
        document = {
            "email": google_email,
            "name": google_name,
            "role": UserRole.CUSTOMER.value,
            "password_hash": "",
            "business_id": None,
            "business_name": None,
            "saved_profile": {
                "payer_name": google_name,
                "billing_zip": None,
            },
            "google_id": google_profile.get("id"),
            "created_at": timestamp,
            "updated_at": timestamp,
        }
        result = await db.users.insert_one(document)
        user = await db.users.find_one({"_id": result.inserted_id})
    else:
        # Update google_id if not set
        if not user.get("google_id") and google_profile.get("id"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"google_id": google_profile["id"]}},
            )

    # Optional role check
    if payload.expected_role and user["role"] != payload.expected_role.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This Google account does not have access to that portal.",
        )

    return _token_response(user)
