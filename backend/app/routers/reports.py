from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.database import get_db
from app.schemas import UserRole
from app.security import get_current_portal_user
from app.serializers import serialize_email_log, serialize_transaction
from app.utils import csv_buffer, parse_date_filter


router = APIRouter(prefix="/reports", tags=["reports"])


def _build_filter(
    *,
    current_user: dict,
    page_id: str | None,
    status: str | None,
    date_from: str | None,
    date_to: str | None,
) -> dict:
    query: dict = {}
    if current_user["role"] == UserRole.BUSINESS.value:
        query["business_id"] = current_user.get("business_id")

    if page_id:
        query["page_id"] = page_id
    if status:
        query["status"] = status.upper()

    created_at: dict = {}
    start = parse_date_filter(date_from)
    end = parse_date_filter(date_to, end_of_day=True)
    if start:
        created_at["$gte"] = start
    if end:
        created_at["$lte"] = end
    if created_at:
        query["created_at"] = created_at

    return query


@router.get("/transactions")
async def list_transactions(
    page_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(get_current_portal_user),
) -> dict:
    db = get_db()
    query = _build_filter(
        current_user=current_user,
        page_id=page_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(length=500)
    return {"items": [serialize_transaction(transaction) for transaction in transactions]}


@router.get("/summary")
async def get_summary(
    page_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(get_current_portal_user),
) -> dict:
    db = get_db()
    query = _build_filter(
        current_user=current_user,
        page_id=page_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    transactions = await db.transactions.find(query).to_list(length=500)

    successful = [transaction for transaction in transactions if transaction["status"] == "SUCCESS"]
    non_failed = [transaction for transaction in transactions if transaction["status"] != "FAILED"]

    gl_breakdown: dict[str, int] = {}
    payment_method_breakdown: dict[str, int] = {}
    for transaction in non_failed:
        payment_method_breakdown[transaction["payment_method"]] = payment_method_breakdown.get(transaction["payment_method"], 0) + 1
        for code in transaction.get("gl_codes_snapshot", []):
            gl_breakdown[code] = gl_breakdown.get(code, 0) + transaction["amount_cents"]

    total_amount = sum(transaction["amount_cents"] for transaction in successful)
    average_amount = int(total_amount / len(successful)) if successful else 0

    return {
        "item": {
            "transaction_count": len(transactions),
            "total_amount_cents": total_amount,
            "average_amount_cents": average_amount,
            "gl_breakdown": gl_breakdown,
            "payment_method_breakdown": payment_method_breakdown,
        }
    }


@router.get("/email-logs")
async def list_email_logs(current_user: dict = Depends(get_current_portal_user)) -> dict:
    db = get_db()
    query = {}
    if current_user["role"] == UserRole.BUSINESS.value:
        query["business_id"] = current_user.get("business_id")
    logs = await db.email_logs.find(query).sort("created_at", -1).to_list(length=100)
    return {"items": [serialize_email_log(log) for log in logs]}


@router.get("/export.csv")
async def export_transactions_csv(
    page_id: str | None = None,
    status: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(get_current_portal_user),
) -> StreamingResponse:
    db = get_db()
    query = _build_filter(
        current_user=current_user,
        page_id=page_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    transactions = await db.transactions.find(query).sort("created_at", -1).to_list(length=500)

    rows = [
        {
            "public_id": transaction["public_id"],
            "business_name": transaction.get("business_name"),
            "page_title": transaction["page_title"],
            "payer_name": transaction["payer_name"],
            "payer_email": transaction["payer_email"],
            "original_amount_cents": transaction.get("original_amount_cents", transaction["amount_cents"]),
            "discount_amount_cents": transaction.get("discount_amount_cents", 0),
            "amount_cents": transaction["amount_cents"],
            "coupon_code": transaction.get("coupon_code"),
            "payment_method": transaction["payment_method"],
            "status": transaction["status"],
            "created_at": transaction["created_at"].isoformat(),
        }
        for transaction in transactions
    ]
    buffer = csv_buffer(rows)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions.csv"'},
    )
