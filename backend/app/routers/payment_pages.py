from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.schemas import PaymentPagePayload, UserRole
from app.security import get_current_portal_user, page_belongs_to_user
from app.serializers import serialize_page, serialize_page_summary
from app.utils import (
    ensure_field_key,
    generate_item_id,
    normalize_color,
    normalize_coupon_code,
    now_utc,
    slugify,
    validate_coupon_code,
    validate_gl_code,
)


router = APIRouter(tags=["payment-pages"])


def _normalize_page_payload(payload: PaymentPagePayload) -> dict:
    custom_fields = []
    seen_keys: set[str] = set()
    for index, field in enumerate(sorted(payload.custom_fields, key=lambda item: item.sort_order)):
        key = ensure_field_key(field.label, field.key)
        if key in seen_keys:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Duplicate field key: {key}")
        seen_keys.add(key)
        custom_fields.append(
            {
                "id": field.id or generate_item_id(),
                "key": key,
                "label": field.label.strip(),
                "type": field.type.value,
                "options": field.options,
                "is_required": field.is_required,
                "placeholder": field.placeholder,
                "helper_text": field.helper_text,
                "sort_order": index,
            }
        )

    gl_codes = []
    seen_codes: set[str] = set()
    for index, gl_code in enumerate(sorted(payload.gl_codes, key=lambda item: item.sort_order)):
        normalized_code = gl_code.code.strip().upper()
        if not validate_gl_code(normalized_code):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid GL code: {normalized_code}")
        if normalized_code in seen_codes:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Duplicate GL code: {normalized_code}")
        seen_codes.add(normalized_code)
        gl_codes.append(
            {
                "id": gl_code.id or generate_item_id(),
                "code": normalized_code,
                "label": gl_code.label,
                "sort_order": index,
            }
        )

    coupon_codes = []
    seen_coupon_codes: set[str] = set()
    for coupon in payload.coupon_codes:
        normalized_code = normalize_coupon_code(coupon.code)
        if not validate_coupon_code(normalized_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid coupon code: {coupon.code}",
            )
        if normalized_code in seen_coupon_codes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate coupon code: {normalized_code}",
            )
        seen_coupon_codes.add(normalized_code)
        coupon_codes.append(
            {
                "id": coupon.id or generate_item_id(),
                "code": normalized_code,
                "description": coupon.description,
                "type": coupon.type.value,
                "percent_off": coupon.percent_off,
                "amount_off_cents": coupon.amount_off_cents,
                "minimum_amount_cents": coupon.minimum_amount_cents,
                "is_active": coupon.is_active,
            }
        )

    return {
        "slug": slugify(payload.slug),
        "organization_name": payload.organization_name.strip(),
        "title": payload.title.strip(),
        "subtitle": payload.subtitle,
        "header_message": payload.header_message,
        "footer_message": payload.footer_message,
        "logo_url": payload.logo_url,
        "support_email": str(payload.support_email) if payload.support_email else None,
        "brand_color": normalize_color(payload.brand_color),
        "amount_mode": payload.amount_mode.value,
        "fixed_amount_cents": payload.fixed_amount_cents,
        "min_amount_cents": payload.min_amount_cents,
        "max_amount_cents": payload.max_amount_cents,
        "email_template": payload.email_template,
        "is_active": payload.is_active,
        "custom_fields": custom_fields,
        "gl_codes": gl_codes,
        "coupon_codes": coupon_codes,
    }


def _parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except InvalidId as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.") from error


def _page_scope_filter(current_user: dict) -> dict:
    if current_user["role"] == UserRole.ADMIN.value:
        return {}
    return {"business_id": current_user.get("business_id")}


@router.get("/payment-pages")
async def list_payment_pages(current_user: dict = Depends(get_current_portal_user)) -> dict:
    db = get_db()
    scope_filter = _page_scope_filter(current_user)

    metrics_pipeline: list[dict] = []
    if scope_filter:
        metrics_pipeline.append({"$match": scope_filter})
    metrics_pipeline.append(
        {
            "$group": {
                "_id": "$page_id",
                "transaction_count": {"$sum": 1},
                "total_amount_cents": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "SUCCESS"]}, "$amount_cents", 0]
                    }
                },
            }
        }
    )

    metrics_cursor = db.transactions.aggregate(metrics_pipeline)
    metrics = {item["_id"]: item async for item in metrics_cursor}

    pages = await db.payment_pages.find(scope_filter).sort("updated_at", -1).to_list(length=100)
    return {"items": [serialize_page_summary(page, metrics.get(str(page["_id"]), {})) for page in pages]}


@router.post("/payment-pages", status_code=status.HTTP_201_CREATED)
async def create_payment_page(payload: PaymentPagePayload, current_user: dict = Depends(get_current_portal_user)) -> dict:
    db = get_db()
    document = _normalize_page_payload(payload)

    existing = await db.payment_pages.find_one({"slug": document["slug"]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That slug is already in use.")

    if current_user["role"] == UserRole.BUSINESS.value:
        document["business_id"] = current_user.get("business_id")
        document["business_name"] = current_user.get("business_name") or document["organization_name"]
    else:
        document["business_id"] = slugify(document["organization_name"])
        document["business_name"] = document["organization_name"]

    timestamp = now_utc()
    document["created_at"] = timestamp
    document["updated_at"] = timestamp
    result = await db.payment_pages.insert_one(document)
    created = await db.payment_pages.find_one({"_id": result.inserted_id})
    return {"item": serialize_page(created)}


@router.get("/payment-pages/{page_id}")
async def get_payment_page(page_id: str, current_user: dict = Depends(get_current_portal_user)) -> dict:
    db = get_db()
    page = await db.payment_pages.find_one({"_id": _parse_object_id(page_id)})
    if not page or not page_belongs_to_user(current_user, page):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.")
    return {"item": serialize_page(page)}


@router.put("/payment-pages/{page_id}")
async def update_payment_page(
    page_id: str,
    payload: PaymentPagePayload,
    current_user: dict = Depends(get_current_portal_user),
) -> dict:
    db = get_db()
    object_id = _parse_object_id(page_id)
    existing = await db.payment_pages.find_one({"_id": object_id})
    if not existing or not page_belongs_to_user(current_user, existing):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.")

    document = _normalize_page_payload(payload)
    slug_owner = await db.payment_pages.find_one({"slug": document["slug"]})
    if slug_owner and slug_owner["_id"] != object_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That slug is already in use.")

    document["created_at"] = existing["created_at"]
    document["updated_at"] = now_utc()
    if current_user["role"] == UserRole.BUSINESS.value:
        document["business_id"] = current_user.get("business_id")
        document["business_name"] = current_user.get("business_name") or existing.get("business_name")
    else:
        document["business_id"] = existing.get("business_id") or slugify(document["organization_name"])
        document["business_name"] = existing.get("business_name") or document["organization_name"]

    await db.payment_pages.update_one({"_id": object_id}, {"$set": document})
    updated = await db.payment_pages.find_one({"_id": object_id})
    return {"item": serialize_page(updated)}


@router.get("/public/payment-pages/{slug}")
async def get_public_payment_page(slug: str) -> dict:
    db = get_db()
    page = await db.payment_pages.find_one({"slug": slugify(slug), "is_active": True})
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.")
    return {"item": serialize_page(page, public=True)}
