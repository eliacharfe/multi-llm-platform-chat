

# apps/api/polar_billing.py

import os
import json
import hmac
import hashlib
import httpx

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
import firebase_admin.auth as fb_auth

from user_service import set_premium as db_set_premium, get_or_create_user

router = APIRouter()

IS_SANDBOX = os.getenv("POLAR_ENV", "production") == "sandbox"

POLAR_ACCESS_TOKEN = os.environ["POLAR_ACCESS_TOKEN"]
POLAR_WEBHOOK_SECRET = os.environ["POLAR_WEBHOOK_SECRET"]

POLAR_BASE_URL = "https://sandbox-api.polar.sh" if IS_SANDBOX else "https://api.polar.sh"

PRODUCT_IDS = {
    "monthly": os.environ["POLAR_MONTHLY_PRODUCT_ID"],
    "yearly": os.environ["POLAR_YEARLY_PRODUCT_ID"],
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
    product_id = PRODUCT_IDS.get(body.plan)
    if not product_id:
        raise HTTPException(400, f"Invalid plan: {body.plan}")

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        res = await client.post(
            f"{POLAR_BASE_URL}/v1/checkouts",
            headers={
                "Authorization": f"Bearer {POLAR_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={
                "product_id": product_id,
                "success_url": f"{FRONTEND_URL}/premium/success",
                "metadata": {
                    "firebase_uid": uid,
                    "plan": body.plan,
                },
            },
        )

    if not res.is_success:
        print(f"[polar] checkout error: {res.status_code} {res.text}")
        raise HTTPException(500, f"Polar error {res.status_code}: {res.text}")

    data = res.json()
    return {"checkout_url": data["url"], "checkout_id": data["id"]}


def _verify_webhook(body: bytes, headers: dict) -> bool:
    """Verify Polar webhook signature using HMAC-SHA256."""
    webhook_id = headers.get("webhook-id", "")
    webhook_timestamp = headers.get("webhook-timestamp", "")
    webhook_signature = headers.get("webhook-signature", "")

    if not all([webhook_id, webhook_timestamp, webhook_signature]):
        return False

    signed_content = f"{webhook_id}.{webhook_timestamp}.{body.decode()}"
    secret = POLAR_WEBHOOK_SECRET

    # Polar uses base64-encoded secret
    import base64
    try:
        secret_bytes = base64.b64decode(secret.split("whsec_")[1] if secret.startswith("whsec_") else secret)
    except Exception:
        secret_bytes = secret.encode()

    expected = hmac.new(secret_bytes, signed_content.encode(), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode()

    # webhook-signature may contain multiple signatures: "v1,<sig1> v1,<sig2>"
    sigs = webhook_signature.split(" ")
    for sig in sigs:
        if sig.startswith("v1,"):
            if hmac.compare_digest(sig[3:], expected_b64):
                return True
    return False


@router.post("/polar/webhook")
async def polar_webhook(request: Request):
    body = await request.body()

    if not _verify_webhook(body, dict(request.headers)):
        print("[polar webhook] signature verification failed")
        raise HTTPException(403, "Invalid webhook signature")

    payload = json.loads(body)
    event_type = payload.get("type", "")
    data = payload.get("data", {})

    print(f"[polar webhook] event={event_type} data_keys={list(data.keys())}")

    metadata = data.get("metadata") or {}
    firebase_uid = metadata.get("firebase_uid")
    print(f"[polar webhook] metadata={metadata} firebase_uid_from_metadata={firebase_uid}")

    # For subscription events, metadata may be on the checkout
    if not firebase_uid:
        checkout = data.get("checkout") or {}
        checkout_metadata = (checkout.get("metadata") or {})
        firebase_uid = checkout_metadata.get("firebase_uid")
        print(f"[polar webhook] checkout_metadata={checkout_metadata} firebase_uid_from_checkout={firebase_uid}")

    if not firebase_uid:
        customer = data.get("customer") or {}
        customer_metadata = (customer.get("metadata") or {})
        firebase_uid = customer_metadata.get("firebase_uid")
        print(f"[polar webhook] customer_metadata={customer_metadata} firebase_uid_from_customer={firebase_uid}")

    print(f"[polar webhook] final firebase_uid={firebase_uid}")

    if event_type == "subscription.active":
        sub_id = data.get("id")
        print(f"[polar webhook] subscription.active sub_id={sub_id} firebase_uid={firebase_uid}")
        if firebase_uid:
            await _set_premium(firebase_uid, True, polar_subscription_id=sub_id)
        else:
            print(f"[polar webhook] ⚠️ subscription.active — no firebase_uid, skipping premium grant")

    elif event_type == "subscription.canceled":
        print(f"[polar webhook] subscription.canceled firebase_uid={firebase_uid}")
        if firebase_uid:
            await _set_premium(firebase_uid, False)

    elif event_type == "subscription.revoked":
        print(f"[polar webhook] subscription.revoked firebase_uid={firebase_uid}")
        if firebase_uid:
            await _set_premium(firebase_uid, False)

    elif event_type == "subscription.updated":
        status = data.get("status", "")
        sub_id = data.get("id")
        print(f"[polar webhook] subscription.updated status={status} sub_id={sub_id} firebase_uid={firebase_uid}")
        if firebase_uid:
            if status == "active":
                await _set_premium(firebase_uid, True, polar_subscription_id=sub_id)
            elif status in ("canceled", "revoked"):
                await _set_premium(firebase_uid, False)

    return {"ok": True}


async def _set_premium(firebase_uid: str, is_premium: bool, polar_subscription_id: str | None = None):
    try:
        fb_auth.set_custom_user_claims(firebase_uid, {"premium": is_premium})
    except Exception as e:
        print(f"[polar billing] Failed to set Firebase claim for {firebase_uid}: {e}")
    await db_set_premium(firebase_uid, is_premium, paddle_subscription_id=polar_subscription_id)


# --- Cancel subscription ---
@router.post("/v1/subscriptions/cancel")
async def cancel_subscription(
    authorization: str | None = Header(default=None),
):
    uid = _uid_from_token(authorization)
    user = await get_or_create_user(uid)

    sub_id = getattr(user, "paddle_subscription_id", None)
    print(f"[cancel] uid={uid} is_premium={user.is_premium} sub_id={sub_id}")

    if not sub_id:
        print(f"[cancel] ❌ no subscription id found for uid={uid}")
        raise HTTPException(400, "No active subscription found.")
    if not user.is_premium:
        print(f"[cancel] ❌ user not premium uid={uid}")
        raise HTTPException(400, "No active premium subscription.")

    url = f"{POLAR_BASE_URL}/v1/subscriptions/{sub_id}/cancel"
    print(f"[cancel] calling Polar: POST {url}")

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        res = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {POLAR_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
        )

    print(f"[cancel] Polar response: status={res.status_code} body={res.text[:300]}")

    if res.status_code not in (200, 202, 204):
        raise HTTPException(500, f"Polar error {res.status_code}: {res.text}")

    return {"ok": True, "message": "Subscription cancelled at end of billing period."}


# --- Reactivate subscription ---
@router.post("/v1/subscriptions/reactivate")
async def reactivate_subscription(
    authorization: str | None = Header(default=None),
):
    uid = _uid_from_token(authorization)
    user = await get_or_create_user(uid)

    sub_id = getattr(user, "paddle_subscription_id", None)
    if not sub_id:
        raise HTTPException(400, "No subscription found.")

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.patch(
            f"{POLAR_BASE_URL}/v1/subscriptions/{sub_id}",
            headers={
                "Authorization": f"Bearer {POLAR_ACCESS_TOKEN}",
                "Content-Type": "application/json",
            },
            json={"cancel_at_period_end": False},
        )

    if res.status_code not in (200, 202, 204):
        raise HTTPException(500, f"Polar error {res.status_code}: {res.text}")

    return {"ok": True, "message": "Subscription reactivated."}