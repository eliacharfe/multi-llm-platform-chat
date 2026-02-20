# main.py
from pathlib import Path
from dotenv import load_dotenv
# load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().with_name(".env"))
import os
print("DATABASE_URL =", os.getenv("DATABASE_URL"))
import json
from typing import Any, Dict, List, Literal, Optional, Tuple
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import status
from pydantic import BaseModel

import asyncio
import time
from datetime import datetime
from fastapi import Header, HTTPException

from sqlalchemy import select, desc, delete
from sqlalchemy.orm import selectinload

from db import SessionLocal, init_db, Chat as ChatRow, Message as MessageRow, utcnow

from clients import (
    get_openai_compatible_client,
    get_anthropic_client,
    get_gemini_client,
    openrouter_extra_headers,
)



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_OPTIONS = [
    "openai:gpt-5-nano",
    "openai:gpt-5-mini",
    "openai:gpt-5",
    "openrouter:deepseek/deepseek-chat",
    "openrouter:x-ai/grok-4.1-fast",
    "openrouter:openai/gpt-4o-mini",
    "openrouter:mistralai/mistral-large-2512",
    "groq:llama-3.1-8b-instant",
    "groq:llama-3.3-70b-versatile",
    "anthropic:claude-sonnet-4-6",
    "anthropic:claude-opus-4-6",
    "anthropic:claude-haiku-4-5",
    "gemini:models/gemini-2.5-flash-lite",
    "gemini:models/gemini-2.5-flash",
]

DEFAULT_TEMPERATURE = 0.7

TEMPERATURE_BY_MODEL: Dict[str, float] = {
    "openrouter:deepseek/deepseek-chat": 0.7,
    "openrouter:x-ai/grok-4.1-fast": 0.7,
    "openrouter:openai/gpt-4o-mini": 0.7,
    "openrouter:mistralai/mistral-large-2512": 0.6,
    "groq:llama-3.1-8b-instant": 0.7,
    "groq:llama-3.2-3b": 0.6,
    "groq:llama-3.3-70b-versatile": 0.7,
    "anthropic:claude-sonnet-4-6": 0.6,
    "anthropic:claude-opus-4-6": 0.6,
    "anthropic:claude-haiku-4-5": 0.7,
    "gemini:models/gemini-2.5-flash-lite": 0.7,
    "gemini:models/gemini-2.5-flash": 0.7,
}

UNSUPPORTED_PARAMS_BY_MODEL: Dict[str, set] = {
    "gpt-5-nano": {"temperature"},
    "gpt-5-mini": {"temperature"},
    "gpt-5": {"temperature"},
}


class ChatMsg(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    chat_id: str
    model: str
    messages: List[ChatMsg]
    temperature: Optional[float] = None


def sse(payload: Dict[str, Any]) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


def parse_provider_model(provider_model: str) -> Tuple[str, str]:
    if ":" not in provider_model:
        raise RuntimeError("Model must be like 'provider:model_name'")
    provider, model_name = provider_model.split(":", 1)
    provider = (provider or "").strip().lower()
    model_name = (model_name or "").strip()
    if not provider or not model_name:
        raise RuntimeError("Model must be like 'provider:model_name'")
    return provider, model_name


def get_temperature(provider_model: str, req_temp: Optional[float]) -> float:
    if provider_model in TEMPERATURE_BY_MODEL:
        return float(TEMPERATURE_BY_MODEL[provider_model])
    if req_temp is not None:
        return float(req_temp)
    return float(DEFAULT_TEMPERATURE)


def sanitize_openai_messages(raw: List[ChatMsg]) -> List[Dict[str, str]]:
    return [{"role": m.role, "content": m.content or ""} for m in (raw or [])]


def split_system_and_chat(messages: List[ChatMsg]) -> Tuple[Optional[str], List[Dict[str, str]]]:
    system_parts: List[str] = []
    chat: List[Dict[str, str]] = []
    for m in messages or []:
        if m.role == "system":
            if m.content:
                system_parts.append(m.content)
        else:
            chat.append({"role": m.role, "content": m.content or ""})
    system_text = "\n\n".join(system_parts).strip() if system_parts else None
    return system_text, chat


def build_gemini_prompt(messages: List[ChatMsg]) -> str:
    lines: List[str] = []
    for m in messages or []:
        if m.role == "system":
            txt = (m.content or "").strip()
            if txt:
                lines.append(f"System: {txt}")
        elif m.role == "user":
            txt = (m.content or "").strip()
            if txt:
                lines.append(f"User: {txt}")
        elif m.role == "assistant":
            txt = (m.content or "").strip()
            if txt:
                lines.append(f"Assistant: {txt}")
    lines.append("Assistant:")
    return "\n".join(lines).strip()


def openai_stream(provider: str, model_name: str, req: ChatRequest):
    client = get_openai_compatible_client(provider)
    provider_model = req.model
    temp = get_temperature(provider_model, req.temperature)
    unsupported = UNSUPPORTED_PARAMS_BY_MODEL.get(model_name, set())

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "messages": sanitize_openai_messages(req.messages),
        "stream": True,
    }

    if provider == "openrouter":
        hdrs = openrouter_extra_headers()
        if hdrs:
            kwargs["extra_headers"] = hdrs

    if "temperature" not in unsupported:
        kwargs["temperature"] = temp

    def _try_create(extra: Dict[str, Any]):
        return client.chat.completions.create(**extra)

    base = dict(kwargs)

    try:
        stream = _try_create({**base, "max_completion_tokens": 2048})
    except TypeError:
        stream = _try_create({**base, "max_tokens": 2048})

    for event in stream:
        delta = getattr(event.choices[0].delta, "content", None)
        if delta:
            yield sse({"t": delta})

    yield sse({"done": True})


def anthropic_stream(model_name: str, req: ChatRequest):
    client = get_anthropic_client()
    temp = get_temperature(req.model, req.temperature)
    system_text, chat = split_system_and_chat(req.messages)

    kwargs = {
        "model": model_name,
        "max_tokens": 2048,
        "temperature": temp,
        "messages": [m for m in chat if m["role"] in ("user", "assistant")],
    }

    if system_text:
        kwargs["system"] = [{"type": "text", "text": system_text}]

    with client.messages.stream(**kwargs) as stream:
        for text in stream.text_stream:
            if text:
                yield sse({"t": text})

    yield sse({"done": True})


def gemini_stream(model_name: str, req: ChatRequest):
    client = get_gemini_client()
    temp = get_temperature(req.model, req.temperature)
    prompt = build_gemini_prompt(req.messages)

    stream = client.models.generate_content_stream(
        model=model_name,
        contents=prompt,
        config={"temperature": temp},
    )

    for chunk in stream:
        text = getattr(chunk, "text", None)
        if text:
            yield sse({"t": text})

    yield sse({"done": True})


@app.get("/health")
def health():
    return {"ok": True}



@app.on_event("startup")
async def _startup():
    await init_db()

def require_user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id")
    return x_user_id.strip()


class CreateChatRequest(BaseModel):
    model: str

class CreateChatResponse(BaseModel):
    chat_id: str

class ChatListItem(BaseModel):
    id: str
    title: str
    model: str
    updated_at: datetime

class ChatListResponse(BaseModel):
    chats: List[ChatListItem]

class ChatWithMessagesResponse(BaseModel):
    id: str
    title: str
    model: str
    messages: List[ChatMsg]


def derive_title_from_messages(msgs: List[ChatMsg]) -> str:
    first_user = next((m.content.strip() for m in msgs if m.role == "user" and m.content.strip()), "")
    if not first_user:
        return "New Chat"
    one_line = first_user.split("\n")[0].strip()
    return (one_line[:42] + "…") if len(one_line) > 42 else one_line


@app.post("/v1/chats", response_model=CreateChatResponse)
async def create_chat(req: CreateChatRequest, x_user_id: str | None = Header(default=None)):
    user_id = require_user_id(x_user_id)

    if req.model not in MODEL_OPTIONS:
        raise HTTPException(400, f"Unsupported model: {req.model}")

    async with SessionLocal() as session:
        chat = ChatRow(user_id=user_id, model=req.model, title="New Chat", updated_at=utcnow())
        session.add(chat)
        await session.commit()
        await session.refresh(chat)
        return CreateChatResponse(chat_id=chat.id)


@app.get("/v1/chats", response_model=ChatListResponse)
async def list_chats(x_user_id: str | None = Header(default=None)):
    user_id = require_user_id(x_user_id)

    async with SessionLocal() as session:
        rows = (await session.execute(
            select(ChatRow)
            .where(ChatRow.user_id == user_id)
            .order_by(desc(ChatRow.updated_at))
            .limit(50)
        )).scalars().all()

        return ChatListResponse(
            chats=[
                ChatListItem(id=c.id, title=c.title, model=c.model, updated_at=c.updated_at)
                for c in rows
            ]
        )


@app.delete("/v1/chats/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(chat_id: str, x_user_id: str | None = Header(default=None)):
    user_id = require_user_id(x_user_id)

    async with SessionLocal() as session:
        # Ensure chat belongs to this user
        chat = (await session.execute(
            select(ChatRow).where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
        )).scalars().first()

        if not chat:
            raise HTTPException(404, "Chat not found")

        # 1) delete messages (no cascade)
        await session.execute(
            delete(MessageRow).where(MessageRow.chat_id == chat_id)
        )

        # 2) delete the chat
        await session.delete(chat)

        await session.commit()

    return
    

@app.get("/v1/chats/{chat_id}", response_model=ChatWithMessagesResponse)
async def get_chat(chat_id: str, x_user_id: str | None = Header(default=None)):
    user_id = require_user_id(x_user_id)

    async with SessionLocal() as session:
        chat = (await session.execute(
            select(ChatRow)
            .where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
            .options(selectinload(ChatRow.messages))
        )).scalars().first()

        if not chat:
            raise HTTPException(404, "Chat not found")

        return ChatWithMessagesResponse(
            id=chat.id,
            title=chat.title,
            model=chat.model,
            messages=[ChatMsg(role=m.role, content=m.content) for m in chat.messages],
        )





@app.post("/v1/chat/stream")
async def chat_stream(req: ChatRequest, x_user_id: str | None = Header(default=None)):
    user_id = require_user_id(x_user_id)
    provider, model_name = parse_provider_model(req.model)

    if req.model not in MODEL_OPTIONS:
        return StreamingResponse(
            iter([sse({"error": f"Unsupported model: {req.model}"}), sse({"done": True})]),
            media_type="text/event-stream",
        )

    async with SessionLocal() as session:
        # Load chat + history from DB (source of truth)
        chat = (await session.execute(
            select(ChatRow)
            .where(ChatRow.id == req.chat_id, ChatRow.user_id == user_id)
            .options(selectinload(ChatRow.messages))
        )).scalars().first()

        if not chat:
            raise HTTPException(404, "Chat not found")

        if chat.model != req.model:
            chat.model = req.model
            chat.updated_at = utcnow()
            await session.commit()

        last_user = next((m for m in reversed(req.messages or []) if m.role == "user" and (m.content or "").strip()), None)
        if not last_user:
            raise HTTPException(400, "Missing user message")

        user_row = MessageRow(chat_id=chat.id, role="user", content=last_user.content)
        session.add(user_row)
        assistant_row = MessageRow(chat_id=chat.id, role="assistant", content="")
        session.add(assistant_row)

        merged_msgs = [ChatMsg(role=m.role, content=m.content) for m in chat.messages] + [last_user]
        chat.title = derive_title_from_messages(merged_msgs)
        chat.updated_at = utcnow()

        await session.commit()
        await session.refresh(assistant_row)

        assistant_id = assistant_row.id

    async def gen():
        buffer_text = ""
        last_flush = time.monotonic()
        FLUSH_INTERVAL_SEC = 0.25 
        FLUSH_MIN_CHARS = 40

        async def flush(force: bool = False):
            nonlocal buffer_text, last_flush
            if not buffer_text:
                return
            if not force:
                if (time.monotonic() - last_flush) < FLUSH_INTERVAL_SEC and len(buffer_text) < FLUSH_MIN_CHARS:
                    return

            chunk = buffer_text
            buffer_text = ""
            last_flush = time.monotonic()

            async with SessionLocal() as session:
                msg = (await session.execute(
                    select(MessageRow).where(MessageRow.id == assistant_id)
                )).scalars().first()
                if msg:
                    msg.content = (msg.content or "") + chunk

                chat2 = (await session.execute(
                    select(ChatRow).where(ChatRow.id == req.chat_id)
                )).scalars().first()
                if chat2:
                    chat2.updated_at = utcnow()

                await session.commit()

        try:
            async with SessionLocal() as session:
                chat = (await session.execute(
                    select(ChatRow).where(ChatRow.id == req.chat_id, ChatRow.user_id == user_id)
                    .options(selectinload(ChatRow.messages))
                )).scalars().first()

                history = [ChatMsg(role=m.role, content=m.content) for m in (chat.messages if chat else [])]
                llm_req = ChatRequest(
                    chat_id=req.chat_id,
                    model=req.model,
                    messages=history,
                    temperature=req.temperature,
                )

            loop = asyncio.get_event_loop()

            def sync_iter():
                if provider in ("openai", "openrouter", "groq", "nebius"):
                    yield from openai_stream(provider, model_name, llm_req)
                    return
                if provider == "anthropic":
                    yield from anthropic_stream(model_name, llm_req)
                    return
                if provider == "gemini":
                    yield from gemini_stream(model_name, llm_req)
                    return
                raise RuntimeError(f"Unknown provider: {provider}")

            it = iter(sync_iter())

            while True:
                try:
                    chunk = await loop.run_in_executor(None, lambda: next(it))
                except StopIteration:
                    break
                yield chunk

                if chunk.startswith("data: "):
                    payload = chunk[6:].strip()
                    try:
                        obj = json.loads(payload)
                    except Exception:
                        obj = None

                    if isinstance(obj, dict) and obj.get("t"):
                        buffer_text += obj["t"]
                        await flush(False)

                    if isinstance(obj, dict) and obj.get("done"):
                        await flush(True)
                        return

            await flush(True)
            yield sse({"done": True})

        except Exception as e:
            try:
                await flush(True)
            except Exception:
                pass
            yield sse({"error": f"{type(e).__name__}: {str(e)}"})
            yield sse({"done": True})

    return StreamingResponse(gen(), media_type="text/event-stream")