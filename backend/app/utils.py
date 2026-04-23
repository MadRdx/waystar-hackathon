import csv
import io
import re
import secrets
from datetime import UTC, date, datetime
from typing import Any
from uuid import uuid4


GL_CODE_PATTERN = re.compile(r"^[A-Z0-9-]{2,20}$")
COUPON_CODE_PATTERN = re.compile(r"^[A-Z0-9-]{2,32}$")
TOKEN_PATTERN = re.compile(r"{{\s*([^}]+)\s*}}")


def now_utc() -> datetime:
    return datetime.now(UTC)


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower())
    return normalized.strip("-")


def normalize_color(value: str) -> str:
    return value.strip().upper()


def validate_gl_code(code: str) -> bool:
    return bool(GL_CODE_PATTERN.match(code.strip().upper()))


def normalize_coupon_code(code: str) -> str:
    return re.sub(r"[^A-Z0-9-]+", "", code.strip().upper())


def validate_coupon_code(code: str) -> bool:
    return bool(COUPON_CODE_PATTERN.match(normalize_coupon_code(code)))


def ensure_field_key(label: str, explicit_key: str | None = None) -> str:
    return slugify(explicit_key or label).replace("-", "_")


def luhn_is_valid(card_number: str) -> bool:
    digits = [int(char) for char in re.sub(r"\D", "", card_number)]
    if len(digits) < 13:
        return False

    checksum = 0
    parity = len(digits) % 2
    for index, digit in enumerate(digits):
        if index % 2 == parity:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def routing_number_is_valid(routing_number: str) -> bool:
    digits = re.sub(r"\D", "", routing_number)
    if len(digits) != 9:
        return False

    weights = [3, 7, 1] * 3
    checksum = sum(int(digit) * weight for digit, weight in zip(digits, weights, strict=True))
    return checksum % 10 == 0


def expiry_is_valid(month: int | None, year: int | None) -> bool:
    if month is None or year is None or month < 1 or month > 12:
        return False

    current = now_utc()
    normalized_year = year if year > 100 else 2000 + year
    return normalized_year > current.year or (normalized_year == current.year and month >= current.month)


def currency(value_cents: int) -> str:
    return f"${value_cents / 100:,.2f}"


def generate_item_id() -> str:
    return uuid4().hex


def generate_public_transaction_id() -> str:
    stamp = now_utc().strftime("%Y%m%d")
    suffix = secrets.token_hex(3).upper()
    return f"QPP-{stamp}-{suffix}"


def render_email_template(template: str, context: dict[str, Any], field_values: dict[str, Any]) -> str:
    def replace(match: re.Match[str]) -> str:
        token = match.group(1).strip()
        if token.startswith("field."):
            return str(field_values.get(token.replace("field.", "", 1), ""))
        return str(context.get(token, ""))

    return TOKEN_PATTERN.sub(replace, template)


def serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def parse_date_filter(value: str | None, end_of_day: bool = False) -> datetime | None:
    if not value:
        return None

    parsed = datetime.combine(date.fromisoformat(value), datetime.max.time() if end_of_day else datetime.min.time())
    return parsed.replace(tzinfo=UTC)


def csv_buffer(rows: list[dict[str, Any]]) -> io.StringIO:
    buffer = io.StringIO()
    if not rows:
        return buffer

    writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)
    return buffer
