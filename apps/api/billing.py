

# apps/api/billing.py

import os
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from paddle_billing import Client, Environment, Options
from paddle_billing.Entities.Shared import Status
from paddle_billing.Notifications import Verifier, Secret

from db import SessionLocal, utcnow
from sqlalchemy import select
from db import Chat as ChatRow  # reuse your existing db

router = APIRouter()

# ── Paddle client ──────────────────────────────────────────────────────────────
_env = Environment.Sandbox if os.getenv("PADDLE_ENV", "sandbox") == "sandbox" else Environment.Production

paddle = Client(
    os.environ["PADDLE_API_KEY"],
    options=Options(Environment.Production),
)

PRICE_IDS = {
    "monthly": os.environ["PADDLE_MONTHLY_PRICE_ID"],
    "yearly":  os.environ["PADDLE_YEARLY_PRICE_ID"],
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://multillm.net")


# ── Auth helper (reuse your existing one) ─────────────────────────────────────
import firebase_admin.auth as fb_auth

def _uid_from_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = fb_auth.verify_id_token(token)
        uid = decoded.get("uid")
        if not uid:
            raise HTTPException(401, "Invalid token")
        return uid
    except Exception:
        raise HTTPException(401, "Invalid/expired token")


# ── POST /billing/create-checkout-session ─────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan: str  # "monthly" | "yearly"
    

@router.post("/billing/create-checkout-session")
async def create_checkout_session(
    body: CheckoutRequest,
    authorization: str | None = Header(default=None),
):
    uid = _uid_from_token(authorization)

    price_id = PRICE_IDS.get(body.plan)
    if not price_id:
        raise HTTPException(400, f"Invalid plan: {body.plan}")

    try:
        from paddle_billing.Resources.Transactions.Operations.CreateTransaction import CreateTransaction
        from paddle_billing.Resources.Transactions.Operations.Create.TransactionCreateItem import TransactionCreateItem
        from paddle_billing.Entities.Shared.CustomData import CustomData
        from paddle_billing.Entities.Shared.Checkout import Checkout

        result = paddle.transactions.create(
            CreateTransaction(
                items=[TransactionCreateItem(price_id=price_id, quantity=1)],
                custom_data=CustomData({"firebase_uid": uid, "plan": body.plan}),
                checkout=Checkout(url=f"{FRONTEND_URL}/premium/success"),
            )
        )

        print("Transaction created:", result.id)
        checkout_url = f"https://buy.paddle.com/checkout/{result.id}"
        return {"url": checkout_url}

    except Exception as e:
        import traceback
        traceback.print_exc()
        # Print the full Paddle error response
        if hasattr(e, 'error'):
            print("Paddle error detail:", e.error)
        if hasattr(e, 'response'):
            print("Paddle response:", e.response)
        if hasattr(paddle.transactions, 'response'):
            print("Paddle raw response:", paddle.transactions.response)
        raise HTTPException(500, str(e))


# ── POST /billing/webhook ──────────────────────────────────────────────────────
@router.post("/billing/webhook")
async def paddle_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("paddle-signature", "")
    secret = os.getenv("PADDLE_WEBHOOK_SECRET", "")

    # Verify signature
    try:
        verifier = Verifier()
        verifier.verify(body, Secret(secret), signature)
    except Exception:
        raise HTTPException(403, "Invalid webhook signature")

    import json
    payload = json.loads(body)
    event_type = payload.get("event_type", "")
    data = payload.get("data", {})
    custom_data = data.get("custom_data") or {}
    firebase_uid = custom_data.get("firebase_uid")

    if not firebase_uid:
        return {"ok": True}  # nothing to do

    # subscription.activated → grant premium
    if event_type == "subscription.activated":
        await _set_premium(firebase_uid, True)

    # subscription.canceled → revoke premium
    elif event_type == "subscription.canceled":
        await _set_premium(firebase_uid, False)

    # subscription.updated → handle plan changes
    elif event_type == "subscription.updated":
        status = data.get("status", "")
        if status == "active":
            await _set_premium(firebase_uid, True)
        elif status in ("canceled", "paused"):
            await _set_premium(firebase_uid, False)

    return {"ok": True}


async def _set_premium(firebase_uid: str, is_premium: bool):
    """Set custom claim on Firebase user so frontend can check it."""
    try:
        fb_auth.set_custom_user_claims(firebase_uid, {"premium": is_premium})
    except Exception as e:
        print(f"[billing] Failed to set premium claim for {firebase_uid}: {e}")