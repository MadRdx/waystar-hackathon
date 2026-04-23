from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.config import get_settings
from app.database import get_db
from app.emailer import deliver_email
from app.schemas import CouponType, PaymentMethod, PaymentSubmissionPayload, StripeIntentPayload
from app.security import get_optional_customer
from app.serializers import serialize_page, serialize_transaction
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


def _extract_intent_and_refund_amount(event_type: str, event_object: dict[str, Any]) -> tuple[str | None, int | None]:
    if event_type == "charge.refunded":
        return event_object.get("payment_intent"), event_object.get("amount_refunded")
    if event_type.startswith("charge.refund."):
        payment_intent = event_object.get("payment_intent")
        amount = event_object.get("amount")
        return payment_intent, amount
    return None, None


async def _apply_refund_update(payment_intent_id: str, refunded_amount_cents: int) -> None:
    db = get_db()
    transaction = await db.transactions.find_one({"processor_reference": payment_intent_id})
    if not transaction:
        return

    refunded = max(0, min(refunded_amount_cents, int(transaction.get("amount_cents", 0))))
    next_status = "REFUNDED" if refunded >= int(transaction.get("amount_cents", 0)) else transaction.get("status", "SUCCESS")

    await db.transactions.update_one(
        {"_id": transaction["_id"]},
        {
            "$set": {
                "refunded_amount_cents": refunded,
                "status": next_status,
                "refunded_at": now_utc(),
                "updated_at": now_utc(),
                "processor_message": (
                    "Refund completed via Stripe."
                    if next_status == "REFUNDED"
                    else "Partial refund processed via Stripe."
                ),
            }
        },
    )


def _detect_card_brand(card_number_digits: str) -> str | None:
    if card_number_digits.startswith("4"):
        return "VISA"
    if len(card_number_digits) >= 2 and 51 <= int(card_number_digits[:2]) <= 55:
        return "MASTERCARD"
    if len(card_number_digits) >= 4 and 2221 <= int(card_number_digits[:4]) <= 2720:
        return "MASTERCARD"
    if len(card_number_digits) >= 2 and card_number_digits[:2] in {"34", "37"}:
        return "AMEX"
    return None


def _stripe_test_payment_method(payload: PaymentSubmissionPayload) -> str:
    if payload.payment_method == PaymentMethod.CARD:
        digits = "".join(char for char in payload.card_number or "" if char.isdigit())
        if digits in DECLINED_TEST_CARDS or digits.endswith("0002"):
            return "pm_card_chargeDeclined"
        if digits.startswith(("34", "37")):
            return "pm_card_amex"
        if digits.startswith("4"):
            return "pm_card_visa"
        return "pm_card_mastercard"

    if payload.payment_method == PaymentMethod.WALLET:
        provider = (payload.wallet_provider or "").strip().lower()
        if provider in {"apple_pay", "google_pay"}:
            return "pm_card_visa"
        return "pm_card_mastercard"

    return "pm_usBankAccount_success"


def _resolve_stripe_intent(payload: PaymentSubmissionPayload, amount_cents: int) -> tuple[str, str, str | None, str | None]:
    settings = get_settings()
    if not settings.stripe_enabled:
        raise RuntimeError("Stripe is not configured.")
    if not payload.stripe_payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe payment intent is required for card checkout.",
        )

    import stripe

    stripe.api_key = settings.stripe_secret_key
    intent = stripe.PaymentIntent.retrieve(payload.stripe_payment_intent_id)
    if not intent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stripe payment was not found.")

    intent_amount = int(intent.get("amount") or 0)
    if intent_amount != amount_cents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stripe payment amount does not match the submitted payment amount.",
        )

    intent_status = intent.get("status", "")
    intent_id = intent.get("id")
    if intent_status in {"succeeded"}:
        return ("SUCCESS", f"Stripe approved ({intent_status}).", intent_id, "Payment approved.")
    if intent_status in {"processing", "requires_capture"}:
        return (
            "PENDING",
            f"Stripe processing ({intent_status}).",
            intent_id,
            "Payment accepted and pending processor completion.",
        )
    if intent_status in {"requires_action", "requires_payment_method", "canceled"}:
        return (
            "FAILED",
            f"Stripe status {intent_status}.",
            intent_id,
            "Stripe did not complete the payment confirmation.",
        )

    return ("FAILED", f"Stripe status {intent_status}.", intent_id, "Stripe payment verification failed.")


def _process_payment_method_with_stripe(
    payload: PaymentSubmissionPayload, amount_cents: int, description: str
) -> tuple[str, str, str | None, str | None]:
    settings = get_settings()
    if not settings.stripe_enabled:
        raise RuntimeError("Stripe is not configured.")

    import stripe

    stripe.api_key = settings.stripe_secret_key

    payment_method = _stripe_test_payment_method(payload)
    intent = stripe.PaymentIntent.create(
        amount=amount_cents,
        currency=settings.stripe_currency.lower(),
        confirm=True,
        payment_method=payment_method,
        metadata={
            "qpp_flow": "public_payment_page",
            "payment_method": payload.payment_method.value,
            "wallet_provider": payload.wallet_provider or "",
            "payer_email": payload.payer_email.lower(),
        },
        description=description,
        payment_method_types=(
            ["us_bank_account"] if payload.payment_method == PaymentMethod.ACH else ["card"]
        ),
    )

    intent_status = intent.get("status", "")
    intent_id = intent.get("id")
    if intent_status in {"requires_payment_method", "canceled"}:
        return (
            "FAILED",
            "Stripe declined the payment method.",
            intent_id,
            "Payment declined by Stripe test processor.",
        )
    if intent_status in {"processing", "requires_action"}:
        return (
            "PENDING",
            f"Stripe processing ({intent_status}).",
            intent_id,
            "Payment accepted and pending processor completion.",
        )
    return ("SUCCESS", f"Stripe approved ({intent_status}).", intent_id, "Payment approved.")


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


def _process_payment_method(
    page: dict[str, Any], payload: PaymentSubmissionPayload, amount_cents: int
) -> tuple[str, str, str | None, str | None, str]:
    processor_mode = "sandbox"

    if payload.payment_method == PaymentMethod.CARD:
        if payload.stripe_payment_intent_id:
            status_value, processor_message, processor_reference, response_message = _resolve_stripe_intent(
                payload, amount_cents
            )
            return (status_value, processor_message, processor_reference, response_message, "stripe")

        digits = "".join(char for char in payload.card_number or "" if char.isdigit())
        if not digits or not luhn_is_valid(digits):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid card number.")
        card_brand = _detect_card_brand(digits)
        if not card_brand:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Visa, Mastercard, and American Express are supported in sandbox mode.",
            )
        if not expiry_is_valid(payload.expiry_month, payload.expiry_year):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Card expiration date is invalid.")
        if not payload.cvv or not payload.cvv.isdigit() or len(payload.cvv) not in {3, 4}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CVV must be 3 or 4 digits.")
        if card_brand == "AMEX" and len(payload.cvv) != 4:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="American Express requires a 4-digit CVV.")
        if not payload.billing_zip or len(payload.billing_zip.strip()) < 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Billing ZIP is required.")
        try:
            status_value, processor_message, processor_reference, response_message = _process_payment_method_with_stripe(
                payload=payload,
                amount_cents=amount_cents,
                description=f"QPP {page.get('slug')} card payment",
            )
            return (status_value, processor_message, processor_reference, response_message, "stripe")
        except Exception:
            processor_mode = "sandbox"
        if digits in DECLINED_TEST_CARDS or digits.endswith("0002"):
            return (
                "FAILED",
                "Sandbox card decline triggered.",
                "sandbox_card_decline",
                "Card was declined in sandbox mode.",
                processor_mode,
            )
        return (
            "SUCCESS",
            f"Sandbox approval ({card_brand}).",
            f"sandbox_card_{digits[-4:]}",
            "Payment approved.",
            processor_mode,
        )

    if payload.payment_method == PaymentMethod.WALLET:
        provider = (payload.wallet_provider or "").strip().lower()
        if provider not in {"apple_pay", "google_pay", "paypal", "venmo"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A supported wallet provider is required.")
        try:
            status_value, processor_message, processor_reference, response_message = _process_payment_method_with_stripe(
                payload=payload,
                amount_cents=amount_cents,
                description=f"QPP {page.get('slug')} wallet payment ({provider})",
            )
            return (status_value, processor_message, processor_reference, response_message, "stripe")
        except Exception:
            return (
                "SUCCESS",
                "Wallet authorization approved.",
                f"sandbox_wallet_{provider}",
                "Digital wallet payment approved.",
                processor_mode,
            )

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
    try:
        status_value, processor_message, processor_reference, response_message = _process_payment_method_with_stripe(
            payload=payload,
            amount_cents=amount_cents,
            description=f"QPP {page.get('slug')} ACH payment",
        )
        return (status_value, processor_message, processor_reference, response_message, "stripe")
    except Exception:
        return (
            "PENDING",
            "ACH file queued for settlement.",
            "sandbox_ach_pending",
            "ACH submitted. Settlement takes 2-3 business days.",
            processor_mode,
        )


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
        or """<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #0F766E; padding: 30px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Payment Receipt</h1>
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <p style="font-size: 16px; color: #374151; margin-top: 0;">Hello <strong>{{payerName}}</strong>,</p>
    <p style="font-size: 16px; color: #374151; line-height: 1.5;">Thank you for your payment! We have successfully received your payment for <strong>{{pageTitle}}</strong>.</p>
    
    <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
      <h2 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Payment Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">Amount Paid:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; font-weight: 600; text-align: right;">{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px;">Date:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; text-align: right;">{{date}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #4b5563; font-size: 15px; border-bottom: none;">Transaction ID:</td>
          <td style="padding: 8px 0; color: #111827; font-size: 15px; text-align: right; font-family: monospace;">{{transactionId}}</td>
        </tr>
      </table>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">If you have any questions about this receipt, please contact support.</p>
  </div>
  <div style="background-color: #f9fafb; padding: 15px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af; margin: 0;">Powered by Waystar Quick Payment Pages</p>
  </div>
</div>"""
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
    status_value, processor_message, processor_reference, response_message, processor_mode = _process_payment_method(
        page, payload, coupon_result["final_amount_cents"]
    )

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
        "processor_mode": processor_mode,
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


@router.post("/payment-pages/{slug}/stripe/intent")
async def create_stripe_intent(slug: str, payload: StripeIntentPayload) -> dict:
    settings = get_settings()
    if not settings.stripe_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Stripe is not configured on this server.",
        )

    db = get_db()
    page = await db.payment_pages.find_one({"slug": slugify(slug), "is_active": True})
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment page not found.")

    # Reuse existing amount/coupon validation for intent creation.
    hydrated_payload = PaymentSubmissionPayload(
        payer_name=payload.payer_name,
        payer_email=payload.payer_email,
        amount_cents=payload.amount_cents,
        payment_method=PaymentMethod.CARD,
        coupon_code=payload.coupon_code,
    )
    original_amount_cents = _resolve_amount(page, hydrated_payload)
    coupon_result = _apply_coupon(page, original_amount_cents, payload.coupon_code)

    import stripe

    stripe.api_key = settings.stripe_secret_key
    intent = stripe.PaymentIntent.create(
        amount=coupon_result["final_amount_cents"],
        currency=settings.stripe_currency.lower(),
        automatic_payment_methods={"enabled": True},
        metadata={
            "qpp_flow": "public_payment_page",
            "payment_method": "CARD",
            "page_slug": page["slug"],
            "payer_email": payload.payer_email.lower(),
            "coupon_code": coupon_result["coupon_code"] or "",
        },
        description=f"QPP {page['slug']} card payment",
        receipt_email=payload.payer_email.lower(),
    )

    return {
        "item": {
            "payment_intent_id": intent.get("id"),
            "client_secret": intent.get("client_secret"),
            "amount_cents": coupon_result["final_amount_cents"],
            "original_amount_cents": coupon_result["original_amount_cents"],
            "discount_amount_cents": coupon_result["discount_amount_cents"],
            "coupon_code": coupon_result["coupon_code"],
            "coupon_description": coupon_result["coupon_description"],
        }
    }


@router.get("/transactions/{public_id}")
async def get_public_transaction(public_id: str) -> dict:
    db = get_db()
    transaction = await db.transactions.find_one({"public_id": public_id})
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")
    return {"item": serialize_transaction(transaction)}


@router.get("/payment-pages")
async def list_public_payment_pages() -> dict:
    db = get_db()
    pages = await db.payment_pages.find({"is_active": True}).sort("updated_at", -1).to_list(length=100)
    return {"items": [serialize_page(page, public=True) for page in pages]}
@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None, alias="Stripe-Signature"),
) -> dict:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Stripe is not configured.")

    payload = await request.body()
    import stripe

    stripe.api_key = settings.stripe_secret_key
    event: dict[str, Any]

    if settings.stripe_webhook_secret:
        if not stripe_signature:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature header.")
        try:
            parsed = stripe.Webhook.construct_event(payload, stripe_signature, settings.stripe_webhook_secret)
            event = dict(parsed)
        except Exception as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook signature.") from error
    else:
        try:
            event = stripe.Event.construct_from(await request.json(), stripe.api_key)
        except Exception as error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe webhook payload.") from error

    event_type = str(event.get("type", ""))
    event_object = dict(event.get("data", {}).get("object", {}))

    payment_intent_id, refunded_amount = _extract_intent_and_refund_amount(event_type, event_object)
    if payment_intent_id and refunded_amount is not None:
        await _apply_refund_update(payment_intent_id, int(refunded_amount))

    return {"received": True}
