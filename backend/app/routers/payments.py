from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_db
from app.emailer import deliver_email
from app.schemas import CouponType, PaymentMethod, PaymentSubmissionPayload
from app.security import get_optional_customer
from app.serializers import serialize_transaction
from app.utils import (
    currency,
    expiry_is_valid,
    generate_public_transaction_id,
    luhn_is_valid,
    normalize_coupon_code,
    now_utc,
    render_email_template,
    routing_number_is_valid,
    slugify,
)


router = APIRouter(prefix="/public", tags=["payments"])


DECLINED_TEST_CARDS = {"4000000000000002", "4000000000009995"}


def _resolve_amount(page: dict[str, Any], payload: PaymentSubmissionPayload) -> int:
    mode = page["amount_mode"]
    if mode == "FIXED":
        return int(page["fixed_amount_cents"])
    if payload.amount_cents is None or payload.amount_cents <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A valid payment amount is required.")
    if mode == "RANGE":
        minimum = int(page["min_amount_cents"])
        maximum = int(page["max_amount_cents"])
        if payload.amount_cents < minimum or payload.amount_cents > maximum:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Amount must be between {currency(minimum)} and {currency(maximum)}.",
            )
    return int(payload.amount_cents)


def _apply_coupon(page: dict[str, Any], original_amount_cents: int, coupon_code: str | None) -> dict[str, Any]:
    normalized_code = normalize_coupon_code(coupon_code or "")
    if not normalized_code:
        return {
            "coupon_code": None,
            "coupon_description": None,
            "discount_amount_cents": 0,
            "original_amount_cents": original_amount_cents,
            "final_amount_cents": original_amount_cents,
        }

    coupon = next(
        (
            item
            for item in page.get("coupon_codes", [])
            if item.get("code") == normalized_code and item.get("is_active", True)
        ),
        None,
    )
    if not coupon:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That coupon code is not valid for this business.")

    minimum_amount = coupon.get("minimum_amount_cents")
    if minimum_amount is not None and original_amount_cents < minimum_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This coupon requires a payment of at least {currency(minimum_amount)}.",
        )

    if coupon["type"] == CouponType.PERCENT.value:
        discount_amount_cents = round(original_amount_cents * (coupon["percent_off"] / 100))
    else:
        discount_amount_cents = int(coupon["amount_off_cents"])

    final_amount_cents = original_amount_cents - discount_amount_cents
    if final_amount_cents <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This coupon would reduce the payment below the minimum payable amount.",
        )

    return {
        "coupon_code": normalized_code,
        "coupon_description": coupon.get("description"),
        "discount_amount_cents": discount_amount_cents,
        "original_amount_cents": original_amount_cents,
        "final_amount_cents": final_amount_cents,
    }


def _validate_custom_fields(page: dict[str, Any], payload: PaymentSubmissionPayload) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for field in sorted(page.get("custom_fields", []), key=lambda item: item.get("sort_order", 0)):
        raw_value = payload.custom_field_values.get(field["key"])
        field_type = field["type"]

        if field_type == "CHECKBOX":
            coerced = bool(raw_value)
        else:
            coerced = str(raw_value).strip() if raw_value is not None else ""

        if field["is_required"]:
            if field_type == "CHECKBOX" and not coerced:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field['label']} must be accepted before you continue.",
                )
            if field_type != "CHECKBOX" and not coerced:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field['label']} is required.",
                )

        if field_type == "DROPDOWN" and coerced and coerced not in field.get("options", []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field['label']} must match one of the configured options.",
            )
        if field_type == "NUMBER" and coerced:
            try:
                float(coerced)
            except ValueError as error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field['label']} must be a valid number.",
                ) from error

        values[field["key"]] = coerced
    return values


def _process_payment_method(payload: PaymentSubmissionPayload) -> tuple[str, str, str | None, str | None]:
    if payload.payment_method == PaymentMethod.CARD:
        digits = "".join(char for char in payload.card_number or "" if char.isdigit())
        if not digits or not luhn_is_valid(digits):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid card number.")
        if not expiry_is_valid(payload.expiry_month, payload.expiry_year):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Card expiration date is invalid.")
        if not payload.cvv or not payload.cvv.isdigit() or len(payload.cvv) not in {3, 4}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CVV must be 3 or 4 digits.")
        if not payload.billing_zip or len(payload.billing_zip.strip()) < 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Billing ZIP is required.")
        if digits in DECLINED_TEST_CARDS or digits.endswith("0002"):
            return ("FAILED", "Sandbox card decline triggered.", "sandbox_card_decline", "Card was declined in sandbox mode.")
        return ("SUCCESS", "Sandbox approval.", f"sandbox_card_{digits[-4:]}", "Payment approved.")

    if payload.payment_method == PaymentMethod.WALLET:
        provider = (payload.wallet_provider or "").strip().lower()
        if provider not in {"apple_pay", "google_pay", "paypal", "venmo"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A supported wallet provider is required.")
        return ("SUCCESS", "Wallet authorization approved.", f"sandbox_wallet_{provider}", "Digital wallet payment approved.")

    routing = "".join(char for char in (payload.ach_routing_number or "") if char.isdigit())
    account = "".join(char for char in (payload.ach_account_number or "") if char.isdigit())
    if not routing_number_is_valid(routing):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Routing number is invalid.")
    if len(account) < 4 or len(account) > 17:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account number is invalid.")
    if not payload.ach_authorized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ACH authorization language must be accepted.",
        )
    return ("PENDING", "ACH file queued for settlement.", "sandbox_ach_pending", "ACH submitted. Settlement takes 2-3 business days.")


async def _record_email(page: dict[str, Any], transaction: dict[str, Any], field_values: dict[str, Any]) -> None:
    db = get_db()
    context = {
        "payerName": transaction["payer_name"],
        "amount": currency(transaction["amount_cents"]),
        "transactionId": transaction["public_id"],
        "date": transaction["created_at"].strftime("%B %d, %Y"),
        "pageTitle": page["title"],
    }
    template = (
        page.get("email_template")
        or "<h1>Thanks, {{payerName}}</h1><p>We received {{amount}} for {{pageTitle}}.</p><p>Transaction ID: {{transactionId}} on {{date}}</p>"
    )
    body_html = render_email_template(template, context, field_values)
    subject = (
        f"{page['organization_name']} payment submitted"
        if transaction["status"] == "PENDING"
        else f"{page['organization_name']} payment receipt"
    )
    delivery_mode, email_status = await deliver_email(
        to_email=transaction["payer_email"],
        subject=subject,
        body_html=body_html,
    )

    await db.email_logs.insert_one(
        {
            "page_id": transaction["page_id"],
            "business_id": transaction.get("business_id"),
            "business_name": transaction.get("business_name"),
            "transaction_id": str(transaction["_id"]),
            "to_email": transaction["payer_email"],
            "subject": subject,
            "body_html": body_html,
            "delivery_mode": delivery_mode,
            "status": email_status,
            "created_at": now_utc(),
        }
    )


async def _update_customer_profile(customer_id: str, payload: PaymentSubmissionPayload) -> None:
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(customer_id)},
        {
            "$set": {
                "name": payload.payer_name.strip(),
                "saved_profile": {
                    "payer_name": payload.payer_name.strip(),
                    "billing_zip": payload.billing_zip.strip() if payload.billing_zip else None,
                },
                "updated_at": now_utc(),
            }
        },
    )


@router.post("/payment-pages/{slug}/payments")
async def submit_payment(
    slug: str,
    payload: PaymentSubmissionPayload,
    current_customer: dict | None = Depends(get_optional_customer),
) -> dict:
    db = get_db()
    page = await db.payment_pages.find_one({"slug": slugify(slug), "is_active": True})
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.")

    original_amount_cents = _resolve_amount(page, payload)
    coupon_result = _apply_coupon(page, original_amount_cents, payload.coupon_code)
    field_values = _validate_custom_fields(page, payload)
    status_value, processor_message, processor_reference, response_message = _process_payment_method(payload)

    timestamp = now_utc()
    transaction_document = {
        "public_id": generate_public_transaction_id(),
        "page_id": str(page["_id"]),
        "page_slug": page["slug"],
        "page_title": page["title"],
        "business_id": page.get("business_id"),
        "business_name": page.get("business_name"),
        "customer_id": current_customer["id"] if current_customer else None,
        "payer_name": payload.payer_name.strip(),
        "payer_email": payload.payer_email.lower(),
        "amount_cents": coupon_result["final_amount_cents"],
        "original_amount_cents": coupon_result["original_amount_cents"],
        "discount_amount_cents": coupon_result["discount_amount_cents"],
        "coupon_code": coupon_result["coupon_code"],
        "coupon_description": coupon_result["coupon_description"],
        "payment_method": payload.payment_method.value,
        "status": status_value,
        "billing_zip": payload.billing_zip,
        "processor_reference": processor_reference,
        "processor_mode": "sandbox",
        "processor_message": processor_message,
        "failure_reason": response_message if status_value == "FAILED" else None,
        "remember_payer": payload.remember_payer,
        "gl_codes_snapshot": [item["code"] for item in page.get("gl_codes", [])],
        "field_responses": [
            {
                "field_id": field["id"],
                "field_key": field["key"],
                "field_label": field["label"],
                "value": field_values.get(field["key"]),
            }
            for field in sorted(page.get("custom_fields", []), key=lambda item: item.get("sort_order", 0))
        ],
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    insert_result = await db.transactions.insert_one(transaction_document)
    transaction_document["_id"] = insert_result.inserted_id

    if current_customer and payload.remember_payer:
        await _update_customer_profile(current_customer["id"], payload)

    if status_value in {"SUCCESS", "PENDING"}:
        await _record_email(page, transaction_document, field_values)

    if status_value == "FAILED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=response_message)

    return {
        "item": {
            "public_id": transaction_document["public_id"],
            "status": status_value,
            "message": response_message,
        }
    }


@router.get("/transactions/{public_id}")
async def get_public_transaction(public_id: str) -> dict:
    db = get_db()
    transaction = await db.transactions.find_one({"public_id": public_id})
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")
    return {"item": serialize_transaction(transaction)}
