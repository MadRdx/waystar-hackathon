import asyncio

from app.config import get_settings
from app.database import close_database_connection, connect_to_database, get_db
from app.security import hash_password
from app.schemas import CouponType, UserRole
from app.utils import now_utc


DEMO_PASSWORD = "ChangeMe123!"


async def main() -> None:
    settings = get_settings()
    await connect_to_database()
    db = get_db()

    await db.users.delete_many({})
    await db.admin_users.delete_many({})
    await db.payment_pages.delete_many({})
    await db.transactions.delete_many({})
    await db.email_logs.delete_many({})

    timestamp = now_utc()

    admin_result = await db.users.insert_one(
        {
            "email": settings.demo_admin_email.lower(),
            "name": "QPP Admin",
            "role": UserRole.ADMIN.value,
            "password_hash": hash_password(settings.demo_admin_password),
            "business_id": None,
            "business_name": None,
            "saved_profile": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )
    del admin_result

    solstice_business_result = await db.users.insert_one(
        {
            "email": "owner@solsticeyoga.example",
            "name": "Maya Chen",
            "role": UserRole.BUSINESS.value,
            "password_hash": hash_password(DEMO_PASSWORD),
            "business_id": "solstice-yoga-studio",
            "business_name": "Solstice Yoga Studio",
            "saved_profile": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )
    del solstice_business_result

    maple_business_result = await db.users.insert_one(
        {
            "email": "billing@maplecityutilities.example",
            "name": "Jordan Patel",
            "role": UserRole.BUSINESS.value,
            "password_hash": hash_password(DEMO_PASSWORD),
            "business_id": "maple-city-utilities",
            "business_name": "Maple City Utilities",
            "saved_profile": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )
    del maple_business_result

    customer_result = await db.users.insert_one(
        {
            "email": "customer@example.com",
            "name": "Avery Johnson",
            "role": UserRole.CUSTOMER.value,
            "password_hash": hash_password(DEMO_PASSWORD),
            "business_id": None,
            "business_name": None,
            "saved_profile": {
                "payer_name": "Avery Johnson",
                "billing_zip": "37209",
            },
            "created_at": timestamp,
            "updated_at": timestamp,
        }
    )

    yoga_page = {
        "slug": "yoga-class",
        "business_id": "solstice-yoga-studio",
        "business_name": "Solstice Yoga Studio",
        "organization_name": "Solstice Yoga Studio",
        "title": "Reserve Your Yoga Class",
        "subtitle": "Secure your mat, save your spot, and pay in under a minute.",
        "header_message": "Wellness should feel calm from the very first click.",
        "footer_message": "Questions? Reply to your confirmation email and our front desk will help.",
        "logo_url": None,
        "support_email": "hello@solsticeyoga.example",
        "brand_color": "#0F766E",
        "amount_mode": "FIXED",
        "fixed_amount_cents": 2500,
        "min_amount_cents": None,
        "max_amount_cents": None,
        "email_template": "<h1>Namaste, {{payerName}}</h1><p>Your payment of <strong>{{amount}}</strong> for {{pageTitle}} is confirmed.</p><p>Transaction: {{transactionId}} on {{date}}</p><p>{{field.student_name}}</p>",
        "is_active": True,
        "custom_fields": [
            {
                "id": "field_student_name",
                "key": "student_name",
                "label": "Student Name",
                "type": "TEXT",
                "options": [],
                "is_required": True,
                "placeholder": "Avery Johnson",
                "helper_text": "Enter the attendee name for class check-in.",
                "sort_order": 0,
            },
            {
                "id": "field_class_date",
                "key": "class_date",
                "label": "Class Date",
                "type": "DATE",
                "options": [],
                "is_required": True,
                "placeholder": None,
                "helper_text": "Pick the date you plan to attend.",
                "sort_order": 1,
            },
            {
                "id": "field_membership_type",
                "key": "membership_type",
                "label": "Membership Type",
                "type": "DROPDOWN",
                "options": ["Drop-in", "Monthly", "Annual"],
                "is_required": True,
                "placeholder": None,
                "helper_text": None,
                "sort_order": 2,
            },
            {
                "id": "field_special_requests",
                "key": "special_requests",
                "label": "Special Requests",
                "type": "TEXT",
                "options": [],
                "is_required": False,
                "placeholder": "Anything the instructor should know?",
                "helper_text": None,
                "sort_order": 3,
            },
        ],
        "gl_codes": [
            {"id": "gl_yoga_4010", "code": "YOGA-4010", "label": "Class Revenue", "sort_order": 0},
            {"id": "gl_well_1100", "code": "WELL-1100", "label": "Membership Services", "sort_order": 1},
        ],
        "coupon_codes": [
            {
                "id": "coupon_save10",
                "code": "SAVE10",
                "description": "10% off recurring students",
                "type": CouponType.PERCENT.value,
                "percent_off": 10,
                "amount_off_cents": None,
                "minimum_amount_cents": 2000,
                "is_active": True,
            },
            {
                "id": "coupon_newyoga",
                "code": "NEWYOGA",
                "description": "$5 off first class",
                "type": CouponType.FIXED.value,
                "percent_off": None,
                "amount_off_cents": 500,
                "minimum_amount_cents": 2000,
                "is_active": True,
            },
        ],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    utility_page = {
        "slug": "city-utilities",
        "business_id": "maple-city-utilities",
        "business_name": "Maple City Utilities",
        "organization_name": "Maple City Utilities",
        "title": "Pay Your Utility Balance",
        "subtitle": "Flexible online payments for water, trash, and service fees.",
        "header_message": "Payments post instantly for cards and wallets. ACH remains pending while bank verification completes.",
        "footer_message": "Include the correct account number to avoid manual review delays.",
        "logo_url": None,
        "support_email": "support@maplecityutilities.example",
        "brand_color": "#1D4ED8",
        "amount_mode": "RANGE",
        "fixed_amount_cents": None,
        "min_amount_cents": 1000,
        "max_amount_cents": 50000,
        "email_template": "<h1>Thank you, {{payerName}}</h1><p>We received {{amount}} for {{pageTitle}}.</p><p>Transaction ID: {{transactionId}}</p><p>Account: {{field.account_number}}</p>",
        "is_active": True,
        "custom_fields": [
            {
                "id": "field_account_number",
                "key": "account_number",
                "label": "Utility Account Number",
                "type": "TEXT",
                "options": [],
                "is_required": True,
                "placeholder": "MCU-102948",
                "helper_text": None,
                "sort_order": 0,
            },
            {
                "id": "field_service_address",
                "key": "service_address",
                "label": "Service Address",
                "type": "TEXT",
                "options": [],
                "is_required": True,
                "placeholder": "101 Market Street",
                "helper_text": None,
                "sort_order": 1,
            },
            {
                "id": "field_paperless",
                "key": "paperless_enrollment",
                "label": "Enroll in Paperless Billing",
                "type": "CHECKBOX",
                "options": [],
                "is_required": False,
                "placeholder": None,
                "helper_text": "We will use your email for future statements.",
                "sort_order": 2,
            },
        ],
        "gl_codes": [
            {"id": "gl_util_2001", "code": "UTIL-2001", "label": "Water Revenue", "sort_order": 0},
            {"id": "gl_util_2002", "code": "UTIL-2002", "label": "Sanitation Revenue", "sort_order": 1},
        ],
        "coupon_codes": [
            {
                "id": "coupon_green5",
                "code": "GREEN5",
                "description": "$5 off when paperless is enabled",
                "type": CouponType.FIXED.value,
                "percent_off": None,
                "amount_off_cents": 500,
                "minimum_amount_cents": 10000,
                "is_active": True,
            }
        ],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    yoga_result = await db.payment_pages.insert_one(yoga_page)
    utility_result = await db.payment_pages.insert_one(utility_page)

    seeded_transaction = {
        "public_id": "QPP-20260423-4A7BC9",
        "page_id": str(yoga_result.inserted_id),
        "page_slug": "yoga-class",
        "page_title": "Reserve Your Yoga Class",
        "business_id": "solstice-yoga-studio",
        "business_name": "Solstice Yoga Studio",
        "customer_id": str(customer_result.inserted_id),
        "payer_name": "Avery Johnson",
        "payer_email": "customer@example.com",
        "amount_cents": 2000,
        "original_amount_cents": 2500,
        "discount_amount_cents": 500,
        "coupon_code": "NEWYOGA",
        "coupon_description": "$5 off first class",
        "payment_method": "CARD",
        "status": "SUCCESS",
        "billing_zip": "37209",
        "processor_reference": "sandbox_card_4242",
        "processor_mode": "sandbox",
        "processor_message": "Sandbox approval.",
        "failure_reason": None,
        "remember_payer": True,
        "gl_codes_snapshot": ["YOGA-4010", "WELL-1100"],
        "field_responses": [
            {"field_id": "field_student_name", "field_key": "student_name", "field_label": "Student Name", "value": "Avery Johnson"},
            {"field_id": "field_class_date", "field_key": "class_date", "field_label": "Class Date", "value": "2026-04-30"},
            {"field_id": "field_membership_type", "field_key": "membership_type", "field_label": "Membership Type", "value": "Monthly"},
        ],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    inserted_transaction = await db.transactions.insert_one(seeded_transaction)

    await db.email_logs.insert_one(
        {
            "page_id": str(yoga_result.inserted_id),
            "business_id": "solstice-yoga-studio",
            "business_name": "Solstice Yoga Studio",
            "transaction_id": str(inserted_transaction.inserted_id),
            "to_email": "customer@example.com",
            "subject": "Your Solstice Yoga receipt",
            "body_html": "<h1>Namaste, Avery Johnson</h1><p>Your payment of $20.00 for Reserve Your Yoga Class is confirmed.</p><p>Transaction: QPP-20260423-4A7BC9</p>",
            "delivery_mode": "preview",
            "status": "SENT",
            "created_at": now_utc(),
        }
    )

    await db.transactions.insert_one(
        {
            "public_id": "QPP-20260423-B19D2F",
            "page_id": str(utility_result.inserted_id),
            "page_slug": "city-utilities",
            "page_title": "Pay Your Utility Balance",
            "business_id": "maple-city-utilities",
            "business_name": "Maple City Utilities",
            "customer_id": None,
            "payer_name": "Jordan Lee",
            "payer_email": "jordan@example.com",
            "amount_cents": 14850,
            "original_amount_cents": 14850,
            "discount_amount_cents": 0,
            "coupon_code": None,
            "coupon_description": None,
            "payment_method": "ACH",
            "status": "PENDING",
            "billing_zip": None,
            "processor_reference": "sandbox_ach_pending",
            "processor_mode": "sandbox",
            "processor_message": "ACH file queued for settlement.",
            "failure_reason": None,
            "remember_payer": False,
            "gl_codes_snapshot": ["UTIL-2001", "UTIL-2002"],
            "field_responses": [
                {"field_id": "field_account_number", "field_key": "account_number", "field_label": "Utility Account Number", "value": "MCU-102948"},
                {"field_id": "field_service_address", "field_key": "service_address", "field_label": "Service Address", "value": "101 Market Street"},
                {"field_id": "field_paperless", "field_key": "paperless_enrollment", "field_label": "Enroll in Paperless Billing", "value": True},
            ],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
    )

    await close_database_connection()


if __name__ == "__main__":
    asyncio.run(main())
