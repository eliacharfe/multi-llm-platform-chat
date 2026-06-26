# db.py
import os
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import String, Text, DateTime, ForeignKey, Index, Boolean, Integer, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("Missing DATABASE_URL (e.g. postgresql+asyncpg://user:pass@host:5433/db)")

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    paddle_subscription_id: Mapped[str | None] = mapped_column(String(128), nullable=True, default=None)  # ADD THIS
    message_count_today: Mapped[int] = mapped_column(Integer, default=0)
    message_count_reset_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    chat_id: Mapped[str] = mapped_column(String(36), nullable=True)
    model: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(50))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str] = mapped_column(String(200), default="New Chat")
    model: Mapped[str] = mapped_column(String(200))
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True, default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    messages: Mapped[List["Message"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    chat_id: Mapped[str] = mapped_column(String(36), ForeignKey("chats.id", ondelete="CASCADE"), index=True)

    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    chat: Mapped["Chat"] = relationship(back_populates="messages")


Index("ix_messages_chat_created", Message.chat_id, Message.created_at)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Safe to run every startup — ADD COLUMN IF NOT EXISTS is idempotent
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS paddle_subscription_id VARCHAR(128)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_usage_user_created ON usage_logs (user_id, created_at DESC)"
        ))