
# apps/api/user_service.py

from datetime import datetime, timedelta
from sqlalchemy import select
from db import SessionLocal, User, utcnow

FREE_DAILY_LIMIT = 20  # messages per day for free users

PREMIUM_MODELS = {
    "anthropic:claude-opus-4-6",
    "openai:gpt-5",
    "openrouter:mistralai/mistral-large-2512",
}


async def get_or_create_user(uid: str) -> User:
    async with SessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.id == uid)
        )).scalars().first()

        if not user:
            user = User(id=uid)
            session.add(user)
            await session.commit()
            await session.refresh(user)

        return user


async def set_premium(uid: str, is_premium: bool) -> None:
    async with SessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.id == uid)
        )).scalars().first()

        if not user:
            user = User(id=uid, is_premium=is_premium)
            session.add(user)
        else:
            user.is_premium = is_premium
            user.updated_at = utcnow()

        await session.commit()


async def check_and_increment_usage(uid: str) -> tuple[bool, int, int]:
    """
    Returns (allowed, used_today, limit)
    Resets count if it's a new day.
    """
    async with SessionLocal() as session:
        user = (await session.execute(
            select(User).where(User.id == uid)
        )).scalars().first()

        if not user:
            user = User(id=uid)
            session.add(user)
            await session.flush()

        # Premium users have no limit
        if user.is_premium:
            user.message_count_today += 1
            user.updated_at = utcnow()
            await session.commit()
            return True, user.message_count_today, -1  # -1 = unlimited

        # Reset count if it's a new day
        now = utcnow()
        if now - user.message_count_reset_at > timedelta(hours=24):
            user.message_count_today = 0
            user.message_count_reset_at = now

        if user.message_count_today >= FREE_DAILY_LIMIT:
            await session.commit()
            return False, user.message_count_today, FREE_DAILY_LIMIT

        user.message_count_today += 1
        user.updated_at = utcnow()
        await session.commit()
        return True, user.message_count_today, FREE_DAILY_LIMIT