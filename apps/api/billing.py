

# apps/api/billing.py

import os
import json
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from paddle_billing import Client, Environment, Options
from paddle_billing.Notifications import Verifier, Secret
from user_service import set_premium as db_set_premium

import firebase_admin.auth as fb_auth

router = APIRouter()

IS_SANDBOX = os.getenv("PADDLE_ENV", "sandbox") == "sandbox"

paddle = Client(
    os.environ["PADDLE_SANDBOX_API_KEY"] if IS_SANDBOX else os.environ["PADDLE_API_KEY"],
    options=Options(Environment.Sandbox if IS_SANDBOX else Environment.Production),
)

PRICE_IDS = {
    "monthly": os.environ["PADDLE_SANDBOX_MONTHLY_PRICE_ID"] if IS_SANDBOX else os.environ["PADDLE_MONTHLY_PRICE_ID"],
    "yearly":  os.environ["PADDLE_SANDBOX_YEARLY_PRICE_ID"] if IS_SANDBOX else os.environ["PADDLE_YEARLY_PRICE_ID"],
}

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://multillm.net")


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


class CheckoutRequest(BaseModel):
    plan: str


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

        result = paddle.transactions.create(
            CreateTransaction(
                items=[TransactionCreateItem(price_id=price_id, quantity=1)],
                custom_data=CustomData({"firebase_uid": uid, "plan": body.plan}),
            )
        )

        print("Transaction created:", result.id)
        return {"transaction_id": result.id}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))


@router.post("/billing/webhook")
async def paddle_webhook(request: Request):
    body = await request.body()
    secret = os.getenv("PADDLE_SANDBOX_WEBHOOK_SECRET" if IS_SANDBOX else "PADDLE_WEBHOOK_SECRET", "")

    class PaddleRequest:
        def __init__(self, body: bytes, headers):
            self.body = body
            self.content = body
            self.data = body
            self.headers = headers

    try:
        verifier = Verifier()
        verifier.verify(PaddleRequest(body, request.headers), Secret(secret))
    except Exception as e:
        print(f"[webhook] signature failed: {e}")
        raise HTTPException(403, "Invalid webhook signature")

    payload = json.loads(body)
    event_type = payload.get("event_type", "")
    data = payload.get("data", {})
    custom_data = data.get("custom_data") or {}
    firebase_uid = custom_data.get("firebase_uid")

    if not firebase_uid:
        return {"ok": True}

    if event_type == "subscription.activated":
        sub_id = data.get("id")  # "sub_abc123"
        await _set_premium(firebase_uid, True, paddle_subscription_id=sub_id)
    elif event_type == "subscription.canceled":
        await _set_premium(firebase_uid, False)
    elif event_type == "subscription.updated":
        status = data.get("status", "")
        if status == "active":
            sub_id = data.get("id")
            await _set_premium(firebase_uid, True, paddle_subscription_id=sub_id)
        elif status in ("canceled", "paused"):
            await _set_premium(firebase_uid, False)

    return {"ok": True}


async def _set_premium(firebase_uid: str, is_premium: bool, paddle_subscription_id: str | None = None):
    try:
        fb_auth.set_custom_user_claims(firebase_uid, {"premium": is_premium})
    except Exception as e:
        print(f"[billing] Failed to set Firebase claim for {firebase_uid}: {e}")
    await db_set_premium(firebase_uid, is_premium, paddle_subscription_id=paddle_subscription_id)


import httpx

@router.post("/v1/subscriptions/cancel")
async def cancel_subscription(
    authorization: str | None = Header(default=None),
):
    uid = _uid_from_token(authorization)

    from user_service import get_or_create_user
    user = await get_or_create_user(uid)

    sub_id = getattr(user, "paddle_subscription_id", None)
    if not sub_id:
        raise HTTPException(400, "No active subscription found.")
    if not user.is_premium:
        raise HTTPException(400, "No active premium subscription.")

    api_key = os.environ["PADDLE_SANDBOX_API_KEY"] if IS_SANDBOX else os.environ["PADDLE_API_KEY"]
    base_url = "https://sandbox-api.paddle.com" if IS_SANDBOX else "https://api.paddle.com"

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{base_url}/subscriptions/{sub_id}/cancel",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"effective_from": "next_billing_period"},
        )

    if res.status_code not in (200, 202):
        body = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        # Already scheduled to cancel — treat as success
        error_code = body.get("error", {}).get("code", "")
        if "subscription_locked" in error_code or "scheduled_change" in error_code:
            return {"ok": True, "message": "Subscription is already scheduled for cancellation."}
        raise HTTPException(500, f"Paddle error {res.status_code}: {res.text}")

    return {"ok": True, "message": "Subscription scheduled for cancellation at end of billing period."}


@router.post("/v1/subscriptions/reactivate")
async def reactivate_subscription(
    authorization: str | None = Header(default=None),
):
    uid = _uid_from_token(authorization)

    from user_service import get_or_create_user
    user = await get_or_create_user(uid)

    sub_id = getattr(user, "paddle_subscription_id", None)
    if not sub_id:
        raise HTTPException(400, "No subscription found.")

    if not user.is_premium:
        raise HTTPException(400, "No active subscription to reactivate.")

    api_key = os.environ["PADDLE_SANDBOX_API_KEY"] if IS_SANDBOX else os.environ["PADDLE_API_KEY"]
    base_url = "https://sandbox-api.paddle.com" if IS_SANDBOX else "https://api.paddle.com"

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.patch(
            f"{base_url}/subscriptions/{sub_id}",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={"scheduled_change": None},
        )

    print(f"[reactivate] status={res.status_code} body={res.text}")

    if res.status_code not in (200, 202, 204):
        raise HTTPException(500, f"Paddle error {res.status_code}: {res.text}")

    return {"ok": True, "message": "Subscription reactivated."}