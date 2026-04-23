from bson import ObjectId
from fastapi import APIRouter, Depends

from app.database import get_db
from app.schemas import CustomerProfilePayload
from app.security import get_current_customer
from app.serializers import serialize_transaction
from app.utils import now_utc


router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("/me/dashboard")
async def get_customer_dashboard(current_customer: dict = Depends(get_current_customer)) -> dict:
    db = get_db()
    customer = await db.users.find_one({"_id": ObjectId(current_customer["id"])})
    transactions = await db.transactions.find({"customer_id": current_customer["id"]}).sort("created_at", -1).to_list(length=50)

    successful = [transaction for transaction in transactions if transaction["status"] == "SUCCESS"]
    total_spend = sum(transaction["amount_cents"] for transaction in successful)

    return {
        "item": {
            "profile": customer.get("saved_profile") or {
                "payer_name": customer.get("name"),
                "billing_zip": None,
            },
            "summary": {
                "transaction_count": len(transactions),
                "successful_payment_count": len(successful),
                "total_spend_cents": total_spend,
            },
            "transactions": [serialize_transaction(transaction) for transaction in transactions],
        }
    }


@router.put("/me/profile")
async def update_customer_profile(
    payload: CustomerProfilePayload,
    current_customer: dict = Depends(get_current_customer),
) -> dict:
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(current_customer["id"])},
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
    updated = await db.users.find_one({"_id": ObjectId(current_customer["id"])})
    return {"user": {
        "id": str(updated["_id"]),
        "email": updated["email"],
        "name": updated.get("name"),
        "role": updated["role"],
        "business_id": updated.get("business_id"),
        "business_name": updated.get("business_name"),
        "saved_profile": updated.get("saved_profile"),
    }}
