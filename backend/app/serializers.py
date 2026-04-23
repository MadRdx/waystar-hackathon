from typing import Any

from app.config import get_settings
from app.utils import currency, serialize_datetime


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


def serialize_page(page: dict[str, Any], *, public: bool = False) -> dict[str, Any]:
    settings = get_settings()
    page_id = str(page["_id"])
    public_url = f"{settings.frontend_app_url}/pay/{page['slug']}"

    payload = {
        "id": page_id,
        "slug": page["slug"],
        "business_id": page.get("business_id"),
        "business_name": page.get("business_name"),
        "organization_name": page["organization_name"],
        "title": page["title"],
        "subtitle": page.get("subtitle"),
        "header_message": page.get("header_message"),
        "footer_message": page.get("footer_message"),
        "logo_url": page.get("logo_url"),
        "support_email": page.get("support_email"),
        "brand_color": page["brand_color"],
        "amount_mode": page["amount_mode"],
        "fixed_amount_cents": page.get("fixed_amount_cents"),
        "min_amount_cents": page.get("min_amount_cents"),
        "max_amount_cents": page.get("max_amount_cents"),
        "is_active": page["is_active"],
        "custom_fields": page.get("custom_fields", []),
        "gl_codes": page.get("gl_codes", []),
        "accepts_coupons": bool(page.get("coupon_codes")),
        "created_at": serialize_datetime(page.get("created_at")),
        "updated_at": serialize_datetime(page.get("updated_at")),
        "public_url": public_url,
        "iframe_snippet": (
            f'<iframe src="{public_url}?embed=1" title="{page["title"]}" '
            'style="width:100%;min-height:960px;border:0;border-radius:24px;overflow:hidden;"></iframe>'
        ),
    }

    if public:
        return payload

    payload["email_template"] = page.get("email_template")
    payload["coupon_codes"] = page.get("coupon_codes", [])
    return payload


def serialize_page_summary(page: dict[str, Any], metrics: dict[str, Any]) -> dict[str, Any]:
    payload = serialize_page(page)
    payload["transaction_count"] = metrics.get("transaction_count", 0)
    payload["total_amount_cents"] = metrics.get("total_amount_cents", 0)
    return payload


def serialize_transaction(transaction: dict[str, Any]) -> dict[str, Any]:
    original_amount = transaction.get("original_amount_cents", transaction["amount_cents"])
    discount_amount = transaction.get("discount_amount_cents", 0)
    return {
        "id": str(transaction["_id"]),
        "public_id": transaction["public_id"],
        "page_id": transaction["page_id"],
        "page_slug": transaction["page_slug"],
        "page_title": transaction["page_title"],
        "business_id": transaction.get("business_id"),
        "business_name": transaction.get("business_name"),
        "customer_id": transaction.get("customer_id"),
        "payer_name": transaction["payer_name"],
        "payer_email": transaction["payer_email"],
        "amount_cents": transaction["amount_cents"],
        "amount_display": currency(transaction["amount_cents"]),
        "original_amount_cents": original_amount,
        "original_amount_display": currency(original_amount),
        "discount_amount_cents": discount_amount,
        "discount_amount_display": currency(discount_amount),
        "coupon_code": transaction.get("coupon_code"),
        "coupon_description": transaction.get("coupon_description"),
        "payment_method": transaction["payment_method"],
        "status": transaction["status"],
        "billing_zip": transaction.get("billing_zip"),
        "processor_reference": transaction.get("processor_reference"),
        "processor_mode": transaction.get("processor_mode", "sandbox"),
        "processor_message": transaction.get("processor_message"),
        "failure_reason": transaction.get("failure_reason"),
        "remember_payer": transaction.get("remember_payer", False),
        "gl_codes_snapshot": transaction.get("gl_codes_snapshot", []),
        "field_responses": transaction.get("field_responses", []),
        "created_at": serialize_datetime(transaction.get("created_at")),
        "updated_at": serialize_datetime(transaction.get("updated_at")),
    }


def serialize_email_log(email_log: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(email_log["_id"]),
        "page_id": email_log["page_id"],
        "business_id": email_log.get("business_id"),
        "business_name": email_log.get("business_name"),
        "transaction_id": email_log.get("transaction_id"),
        "to_email": email_log["to_email"],
        "subject": email_log["subject"],
        "body_html": email_log["body_html"],
        "delivery_mode": email_log["delivery_mode"],
        "status": email_log["status"],
        "created_at": serialize_datetime(email_log.get("created_at")),
    }
