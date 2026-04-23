from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class AmountMode(str, Enum):
    FIXED = "FIXED"
    RANGE = "RANGE"
    OPEN = "OPEN"


class CustomFieldType(str, Enum):
    TEXT = "TEXT"
    NUMBER = "NUMBER"
    DROPDOWN = "DROPDOWN"
    DATE = "DATE"
    CHECKBOX = "CHECKBOX"


class PaymentMethod(str, Enum):
    CARD = "CARD"
    WALLET = "WALLET"
    ACH = "ACH"


class TransactionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PENDING = "PENDING"


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    BUSINESS = "BUSINESS"
    CUSTOMER = "CUSTOMER"


class CouponType(str, Enum):
    PERCENT = "PERCENT"
    FIXED = "FIXED"


class LoginPayload(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    expected_role: UserRole | None = None


class CustomerRegisterPayload(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    billing_zip: str | None = Field(default=None, max_length=10)


class GoogleOAuthPayload(BaseModel):
    code: str = Field(min_length=1, max_length=2048)
    redirect_uri: str = Field(min_length=1, max_length=512)
    expected_role: UserRole | None = None


class CustomerProfilePayload(BaseModel):
    payer_name: str = Field(min_length=2, max_length=80)
    billing_zip: str | None = Field(default=None, max_length=10)


class CustomFieldPayload(BaseModel):
    id: str | None = None
    key: str | None = None
    label: str = Field(min_length=1, max_length=80)
    type: CustomFieldType
    options: list[str] = Field(default_factory=list)
    is_required: bool = False
    placeholder: str | None = Field(default=None, max_length=120)
    helper_text: str | None = Field(default=None, max_length=180)
    sort_order: int = 0

    @field_validator("options")
    @classmethod
    def normalize_options(cls, options: list[str]) -> list[str]:
        return [option.strip() for option in options if option.strip()]

    @model_validator(mode="after")
    def validate_dropdown_options(self) -> "CustomFieldPayload":
        if self.type == CustomFieldType.DROPDOWN and not self.options:
            raise ValueError("Dropdown fields must include at least one option.")
        return self


class GLCodePayload(BaseModel):
    id: str | None = None
    code: str = Field(min_length=2, max_length=20)
    label: str | None = Field(default=None, max_length=80)
    sort_order: int = 0


class CouponPayload(BaseModel):
    id: str | None = None
    code: str = Field(min_length=2, max_length=32)
    description: str | None = Field(default=None, max_length=120)
    type: CouponType
    percent_off: int | None = None
    amount_off_cents: int | None = None
    minimum_amount_cents: int | None = None
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Coupon code is required.")
        return normalized

    @model_validator(mode="after")
    def validate_coupon(self) -> "CouponPayload":
        if self.type == CouponType.PERCENT:
            if self.percent_off is None or self.percent_off <= 0 or self.percent_off >= 100:
                raise ValueError("Percent coupons must be between 1 and 99.")
        if self.type == CouponType.FIXED:
            if self.amount_off_cents is None or self.amount_off_cents <= 0:
                raise ValueError("Fixed coupons must include a positive amount off.")
        return self


class PaymentPagePayload(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    organization_name: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=2, max_length=100)
    subtitle: str | None = Field(default=None, max_length=220)
    header_message: str | None = Field(default=None, max_length=220)
    footer_message: str | None = Field(default=None, max_length=220)
    logo_url: str | None = None
    support_email: EmailStr | None = None
    brand_color: str = Field(default="#0F766E", min_length=4, max_length=20)
    amount_mode: AmountMode
    fixed_amount_cents: int | None = None
    min_amount_cents: int | None = None
    max_amount_cents: int | None = None
    email_template: str | None = Field(default=None, max_length=3000)
    is_active: bool = True
    custom_fields: list[CustomFieldPayload] = Field(default_factory=list, max_length=10)
    gl_codes: list[GLCodePayload] = Field(default_factory=list)
    coupon_codes: list[CouponPayload] = Field(default_factory=list, max_length=25)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Slug is required.")
        return normalized

    @field_validator("brand_color")
    @classmethod
    def validate_brand_color(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized.startswith("#") or len(normalized) not in {4, 7}:
            raise ValueError("Brand color must be a valid hex value.")
        return normalized

    @model_validator(mode="after")
    def validate_amount_rules(self) -> "PaymentPagePayload":
        if not self.gl_codes:
            raise ValueError("At least one GL code is required.")

        if self.amount_mode == AmountMode.FIXED and not self.fixed_amount_cents:
            raise ValueError("A fixed amount is required for fixed pages.")
        if self.amount_mode == AmountMode.RANGE:
            if self.min_amount_cents is None or self.max_amount_cents is None:
                raise ValueError("Min and max amounts are required for range pages.")
            if self.min_amount_cents >= self.max_amount_cents:
                raise ValueError("Minimum amount must be lower than maximum amount.")
        return self


class PaymentSubmissionPayload(BaseModel):
    payer_name: str = Field(min_length=2, max_length=80)
    payer_email: EmailStr
    amount_cents: int | None = None
    payment_method: PaymentMethod
    billing_zip: str | None = Field(default=None, max_length=10)
    card_number: str | None = None
    expiry_month: int | None = None
    expiry_year: int | None = None
    cvv: str | None = None
    wallet_provider: str | None = None
    ach_routing_number: str | None = None
    ach_account_number: str | None = None
    ach_authorized: bool = False
    remember_payer: bool = False
    coupon_code: str | None = Field(default=None, max_length=32)
    custom_field_values: dict[str, Any] = Field(default_factory=dict)


class PaymentResultPayload(BaseModel):
    public_id: str
    status: TransactionStatus
    message: str
