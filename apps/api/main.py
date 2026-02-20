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
from fastapi import UploadFile, File, Form
from io import BytesIO
from pypdf import PdfReader

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

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
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

MAX_FILE_BYTES = 25_000_000   # 25MB per file
MAX_FILE_CHARS = 30_000       # truncate extracted text safely

ALLOWED_TEXT_EXTS = {
    ".txt", ".md", ".json", ".csv", ".log",
    ".yaml", ".yml",
    ".dart", ".py", ".js", ".ts", ".tsx",
    ".html", ".css", ".xml",
    ".swift",
    ".pdf",
}

MAX_FILE_BYTES = 25_000_000   # 25MB per file
MAX_FILE_CHARS = 30_000       # truncate extracted text safely

ALLOWED_TEXT_EXTS = {
    ".txt", ".md", ".json", ".csv", ".log",
    ".yaml", ".yml",
    ".dart", ".py", ".js", ".ts", ".tsx",
    ".html", ".css", ".xml",
    ".swift",
    ".pdf",
}

async def read_upload_to_text(f: UploadFile) -> str:
    name = f.filename or "file"
    ext = ("." + name.split(".")[-1]).lower() if "." in name else ""

    if ext not in ALLOWED_TEXT_EXTS:
        return f"[Unsupported file type: {ext or 'unknown'}]"

    data = await f.read()
    if not data:
        return ""

    if len(data) > MAX_FILE_BYTES:
        return f"[Skipped {name}: file too large]"

    try:
        if ext == ".pdf":
            reader = PdfReader(BytesIO(data))
            parts: list[str] = []
            for page in reader.pages:
                t = page.extract_text() or ""
                if t.strip():
                    parts.append(t)
            text = "\n".join(parts).strip()
        else:
            text = data.decode("utf-8", errors="replace")
    except Exception as e:
        return f"[Failed reading {name}: {type(e).__name__}]"

    if len(text) > MAX_FILE_CHARS:
        text = text[:MAX_FILE_CHARS] + "\n…(truncated)…"

    return text


async def uploads_to_context(files: list[UploadFile]) -> str:
    if not files:
        return ""

    chunks: list[str] = []

    for f in files:
        name = f.filename or "file"
        ext = ("." + name.split(".")[-1]).lower() if "." in name else ""

        if ext in ALLOWED_TEXT_EXTS:
            content = await read_upload_to_text(f)
            if content:
                chunks.append(f"### File: {name}\n{content}")
        else:
            chunks.append(f"### File: {name}\n[Unsupported file type: {ext or 'unknown'}]")

    if not chunks:
        return ""

    return (
        "\n\n=== ATTACHED FILES ===\n\n"
        + "\n\n".join(chunks)
        + "\n\n=== END FILES ===\n"
    )


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




def build_general_task_prompt(user_message: str) -> str:
    task = (user_message or "").strip()

    return f"""
You are a helpful assistant.

## Response rules
- Output MUST be valid Markdown.
- Be concise but complete.
- Use headings and bullet points when it helps clarity.
- If you provide code, use fenced code blocks with the correct language tag.
- If the user asks for steps, provide a numbered list.
- If information is uncertain, say what you’re assuming.

## User message
{task}
""".strip()


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

                # Wrap only the last user message for the LLM call (keep DB stored raw)
                for i in range(len(history) - 1, -1, -1):
                    if history[i].role == "user":
                        wrapped = build_general_task_prompt(history[i].content)
                        history[i] = ChatMsg(role="user", content=wrapped)
                        break
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


from fastapi import UploadFile, File, Form, Header, HTTPException
import json
from typing import List, Optional

def build_file_task_prompt(
    user_message: str,
    file_context: str,
    filenames: list[str],
) -> str:
    files_list = "\n".join([f"- {n}" for n in filenames]) if filenames else "- (none)"

    task = (user_message or "").strip()
    if not task:
        task = "Summarize the attached file(s)."

    return f"""
You are a senior software engineer and technical writer.

## Task
{task}

## Attached files
{files_list}

## Rules
- Use ONLY the content inside **ATTACHED FILES** as your source of truth. If something is missing, say so explicitly.
- Output MUST be valid Markdown.
- Prefer bullet points and short sections.
- For any code you provide, wrap it in fenced code blocks with the correct language tag (e.g. ```swift, ```ts, ```py).
- When you reference code, quote small snippets (1–6 lines) inside fenced blocks — do not paste huge files unless asked.
- If the user asks to “summarize”, provide: **Overview → Key components → Notable logic → Potential issues → Next steps**.
- If the user asks to “review/refactor”, provide: **Findings → Suggested changes → Example patch**.
- If you find bugs or risks, label them clearly as: **⚠️ Issue** and propose a fix.

---

## ATTACHED FILES
{file_context}
""".strip()

@app.post("/v1/chat/stream_with_files")
async def chat_stream_with_files(
    chat_id: str = Form(...),
    model: str = Form(...),
    temperature: Optional[float] = Form(None),
    message: str = Form(""),
    messages: str = Form("[]"),  # JSON string of Msg[]
    files: List[UploadFile] = File(default=[]),
    x_user_id: str | None = Header(default=None),
):
    user_id = require_user_id(x_user_id)

    if model not in MODEL_OPTIONS:
        return StreamingResponse(
            iter([sse({"error": f"Unsupported model: {model}"}), sse({"done": True})]),
            media_type="text/event-stream",
        )

    # Parse messages array coming from the frontend (optional, but keep compatible)
    try:
        parsed = json.loads(messages or "[]")
        req_msgs = [ChatMsg(**m) for m in parsed] if isinstance(parsed, list) else []
    except Exception:
        req_msgs = []

    # Build file context (uses YOUR existing helper)
    file_context = await uploads_to_context(files)

    user_text = (message or "").strip()
    if not user_text and file_context:
        user_text = (
        "Please analyze the attached code.\n"
        "- Give a short overview\n"
        "- Identify key responsibilities\n"
        "- Point out potential bugs, edge cases, and improvements\n"
        "- Suggest refactors (with example code)\n"
        "- If this is Swift, include Swift best practices"
    )
    if file_context:
        user_text = (user_text + "\n\n" + file_context).strip()

    if not user_text:
        return StreamingResponse(
            iter([sse({"error": "Please type a message or upload a file."}), sse({"done": True})]),
            media_type="text/event-stream",
        )

    filenames = [(f.filename or "file") for f in files]
    user_payload = build_file_task_prompt(
    user_message=user_text,
    file_context=file_context,
    filenames=filenames,
)

    provider, model_name = parse_provider_model(model)

    # ----- Persist user msg + create assistant row (same as /v1/chat/stream) -----
    async with SessionLocal() as session:
        chat = (await session.execute(
            select(ChatRow)
            .where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
            .options(selectinload(ChatRow.messages))
        )).scalars().first()

        if not chat:
            raise HTTPException(404, "Chat not found")

        if chat.model != model:
            chat.model = model
            chat.updated_at = utcnow()

        last_user = ChatMsg(role="user", content=user_text)

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

    # ----- Stream + flush into DB like your existing /v1/chat/stream -----
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
                    select(ChatRow).where(ChatRow.id == chat_id)
                )).scalars().first()
                if chat2:
                    chat2.updated_at = utcnow()

                await session.commit()

        try:
            async with SessionLocal() as session:
                chat = (await session.execute(
                    select(ChatRow).where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
                    .options(selectinload(ChatRow.messages))
                )).scalars().first()

                history = [ChatMsg(role=m.role, content=m.content) for m in (chat.messages if chat else [])]

                for i in range(len(history) - 1, -1, -1):
                    if history[i].role == "user":
                        history[i] = ChatMsg(role="user", content=user_payload)
                        break
                    else:
                        history.append(ChatMsg(role="user", content=user_payload))

                llm_req = ChatRequest(
                    chat_id=chat_id,
                    model=model,
                    messages=history,                 # includes the user_text you just stored
                    temperature=temperature,
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