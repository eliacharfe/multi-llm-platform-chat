# main.py
from pathlib import Path
from dotenv import load_dotenv
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
from io import BytesIO
from pypdf import PdfReader

import asyncio
import time
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, desc, delete
from sqlalchemy.orm import selectinload
from fastapi import UploadFile, File, Form, Header, HTTPException

import firebase_admin
from firebase_admin import credentials, auth as fb_auth

from db import SessionLocal, init_db, Chat as ChatRow, Message as MessageRow, utcnow

import openai, inspect
print("OPENAI_VERSION =", getattr(openai, "__version__", "unknown"))
print("OPENAI_FILE =", getattr(openai, "__file__", "unknown"))

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
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://multi-llm-platform-premium.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_sa = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
if not _sa:
    raise RuntimeError("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var")

try:
    sa_obj = json.loads(_sa)
    cred = credentials.Certificate(sa_obj)
except json.JSONDecodeError:
    cred = credentials.Certificate(_sa)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

def require_user_id_from_auth(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    try:
        decoded = fb_auth.verify_id_token(token)
        uid = decoded.get("uid")
        if not uid:
            raise HTTPException(status_code=401, detail="Invalid token (no uid)")
        return uid
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid/expired token")


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

VISION_MODELS = {
    "openai:gpt-5-nano",
    "openai:gpt-5-mini",
    "openai:gpt-5",
    "openrouter:openai/gpt-4o-mini",
    "anthropic:claude-sonnet-4-6", 
    "anthropic:claude-opus-4-6", 
    "anthropic:claude-haiku-4-5", 
    "gemini:models/gemini-2.5-flash-lite",
    "gemini:models/gemini-2.5-flash",
}

ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMAGE_MIMES = {"image/png", "image/jpeg", "image/webp"}

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

def short_error_message(err: str) -> str:
    s = (err or "").strip()

    if "RESOURCE_EXHAUSTED" in s or "Quota exceeded" in s:
        return "Gemini quota exceeded (rate limit). Try again later or switch model."

    if "Invalid/expired token" in s or "Missing Authorization" in s:
        return "Authentication error. Please sign in again."

    first = s.splitlines()[0] if s else "Unknown error"
    return (first[:140] + "…") if len(first) > 140 else first


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


def build_openrouter_chat_messages_with_images(
    messages: List[ChatMsg],
    images: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    """
    Builds OpenAI-compatible chat messages for OpenRouter,
    attaching images to the LAST user message.
    """

    out: List[Dict[str, Any]] = [
        {"role": m.role, "content": m.content or ""}
        for m in (messages or [])
    ]

    if not images:
        return out

    last_user_idx = None
    for i in range(len(out) - 1, -1, -1):
        if out[i]["role"] == "user":
            last_user_idx = i
            break

    if last_user_idx is None:
        return out

    text = out[last_user_idx]["content"] or ""

    parts: List[Dict[str, Any]] = []
    if text:
        parts.append({"type": "text", "text": text})

    for img in images:
        mime = img.get("mime")
        b64 = img.get("b64")
        if not mime or not b64:
            continue

        parts.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}"
            }
        })

    out[last_user_idx]["content"] = parts
    return out


def build_gemini_contents_with_images(
    messages: List[ChatMsg],
    images: List[Dict[str, str]],
) -> Tuple[Optional[str], List[Dict[str, Any]]]:
    """
    Returns:
      - system_text (string or None)
      - contents (Gemini 'contents' array with parts)
    Attaches images to the LAST user message as inline_data parts.
    """
    system_parts: List[str] = []
    contents: List[Dict[str, Any]] = []

    for m in messages or []:
        role = m.role
        text = (m.content or "").strip()

        if role == "system":
            if text:
                system_parts.append(text)
            continue

        if role not in ("user", "assistant"):
            continue

        gemini_role = "user" if role == "user" else "model"
        parts: List[Dict[str, Any]] = []
        if text:
            parts.append({"text": text})

        contents.append({"role": gemini_role, "parts": parts})

    system_text = "\n\n".join(system_parts).strip() if system_parts else None

    if not images:
        return system_text, contents

    last_user_idx = None
    for i in range(len(contents) - 1, -1, -1):
        if contents[i].get("role") == "user":
            last_user_idx = i
            break
    if last_user_idx is None:
        return system_text, contents

    if not contents[last_user_idx].get("parts"):
        contents[last_user_idx]["parts"] = [{"text": ""}]

    for img in images:
        mime = (img.get("mime") or "").lower()
        b64 = img.get("b64") or ""
        if not mime or not b64:
            continue

        contents[last_user_idx]["parts"].append({
            "inline_data": {
                "mime_type": mime,   # image/png | image/jpeg | image/webp
                "data": b64,         # base64 string
            }
        })

    return system_text, contents

def build_anthropic_messages_with_images(
    chat: List[Dict[str, str]],
    images: List[Dict[str, str]],
) -> List[Dict[str, Any]]:
    """
    Converts text messages into Anthropic block format.
    If images exist, attaches them to the LAST user message.
    """

    out: List[Dict[str, Any]] = []

    for m in chat:
        role = m.get("role")
        if role not in ("user", "assistant"):
            continue

        text = (m.get("content") or "").strip()

        out.append({
            "role": role,
            "content": [
                {"type": "text", "text": text}
            ] if text else []
        })

    if not images:
        return out

    last_user_idx = None
    for i in range(len(out) - 1, -1, -1):
        if out[i]["role"] == "user":
            last_user_idx = i
            break

    if last_user_idx is None:
        return out

    if not out[last_user_idx]["content"]:
        out[last_user_idx]["content"] = [{"type": "text", "text": ""}]

    for img in images:
        mime = (img.get("mime") or "").lower()
        b64 = img.get("b64") or ""

        if not mime or not b64:
            continue

        out[last_user_idx]["content"].append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": mime,  # image/png | image/jpeg | image/webp
                "data": b64
            }
        })

    return out


def anthropic_stream(
    model_name: str,
    req: ChatRequest,
    images: List[Dict[str, str]] | None = None,
):
    images = images or []

    client = get_anthropic_client()
    temp = get_temperature(req.model, req.temperature)

    system_text, chat = split_system_and_chat(req.messages)
    messages_for_claude = build_anthropic_messages_with_images(chat, images)

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "max_tokens": 2048,
        "temperature": temp,
        "messages": messages_for_claude,
    }

    if system_text:
        kwargs["system"] = system_text

    with client.messages.stream(**kwargs) as stream:
        for text in stream.text_stream:
            if text:
                yield sse({"t": text})

    yield sse({"done": True})




def build_openai_responses_input(req: ChatRequest, images: list[dict]):
    out = [{"role": m.role, "content": m.content or ""} for m in (req.messages or [])]
    if not images:
        return out

    last_user_idx = None
    for i in range(len(out) - 1, -1, -1):
        if out[i]["role"] == "user":
            last_user_idx = i
            break
    if last_user_idx is None:
        return out

    text = out[last_user_idx]["content"] or ""
    parts = [{"type": "input_text", "text": text}]

    for img in images:
        parts.append({
            "type": "input_image",
            "image_url": f"data:{img['mime']};base64,{img['b64']}",
        })

    out[last_user_idx]["content"] = parts
    return out

def openai_stream(provider: str, model_name: str, req: ChatRequest, images: list[dict] | None = None):
    images = images or []
    client = get_openai_compatible_client(provider)
    provider_model = req.model
    temp = get_temperature(provider_model, req.temperature)
    unsupported = UNSUPPORTED_PARAMS_BY_MODEL.get(model_name, set())

    is_gpt5 = provider == "openai" and model_name.startswith("gpt-5")

    print(f"[openai_stream] provider={provider}, model={model_name}, is_gpt5={is_gpt5}, temp={temp}")
    print(f"[openai_stream] messages count: {len(req.messages or [])}")
    for i, m in enumerate(req.messages or []):
        print(f"[openai_stream]   msg[{i}] role={m.role}, len={len(m.content or '')}ch")

    if is_gpt5:
        input_msgs = build_openai_responses_input(req, images)
        print(f"[openai_stream:gpt5] calling responses.create with {len(input_msgs)} msgs")

        try:
            stream = client.responses.create(
                model=model_name,
                input=input_msgs,
                stream=True,
            )
            print(f"[openai_stream:gpt5] stream created OK: {type(stream)}")
        except Exception as e:
            import traceback
            print(f"[openai_stream:gpt5] ❌ responses.create failed: {type(e).__name__}: {e}")
            traceback.print_exc()
            raise

        event_count = 0
        delta_count = 0
        for event in stream:
            event_count += 1
            event_type = getattr(event, "type", None)

            print(f"[openai_stream:gpt5] event[{event_count}] type={event_type!r} raw={repr(event)[:300]}")

            if event_type == "response.output_text.delta":
                delta = getattr(event, "delta", None)
                print(f"[openai_stream:gpt5]   delta={repr(delta)[:80]}")
                if isinstance(delta, str) and delta:
                    delta_count += 1
                    yield sse({"t": delta})

        print(f"[openai_stream:gpt5] ✅ stream done — {event_count} events, {delta_count} deltas yielded")
        yield sse({"done": True})
        return

    print(f"[openai_stream] using chat.completions API")

    if provider == "openrouter" and images:
        print("[openai_stream] using multimodal messages for OpenRouter")
        messages_payload = build_openrouter_chat_messages_with_images(
            req.messages,
            images,
        )
    else:
        messages_payload = sanitize_openai_messages(req.messages)

    kwargs: Dict[str, Any] = {
        "model": model_name,
        "messages": messages_payload,
        "stream": True,
    }

    if provider == "openrouter":
        hdrs = openrouter_extra_headers()
        if hdrs:
            kwargs["extra_headers"] = hdrs
            print(f"[openai_stream] openrouter extra_headers: {hdrs}")

    if "temperature" not in unsupported:
        kwargs["temperature"] = temp
    else:
        print(f"[openai_stream] ⚠️ temperature skipped (unsupported for {model_name})")

    try:
        stream = client.chat.completions.create(**kwargs, max_completion_tokens=2048)
        print(f"[openai_stream] stream created with max_completion_tokens=2048")
    except TypeError as e:
        print(f"[openai_stream] max_completion_tokens failed ({e}), retrying with max_tokens")
        stream = client.chat.completions.create(**kwargs, max_tokens=2048)
        print(f"[openai_stream] stream created with max_tokens=2048")
    except Exception as e:
        import traceback
        print(f"[openai_stream] ❌ chat.completions.create failed: {type(e).__name__}: {e}")
        traceback.print_exc()
        raise

    event_count = 0
    delta_count = 0
    for event in stream:
        event_count += 1
        choice = event.choices[0] if event.choices else None
        if not choice:
            print(f"[openai_stream] ⚠️ event[{event_count}] has no choices: {event!r}")
            continue

        finish_reason = getattr(choice, "finish_reason", None)
        delta_obj = getattr(choice, "delta", None)
        delta = _extract_delta_text(delta_obj)

        if event_count <= 3:
            print(f"[openai_stream] event[{event_count}] delta_obj={delta_obj!r}, extracted={delta!r}, finish={finish_reason!r}")

        if finish_reason and finish_reason != "stop":
            print(f"[openai_stream] finish_reason={finish_reason!r} at event {event_count}")

        if delta:
            delta_count += 1
            yield sse({"t": delta})

    print(f"[openai_stream] ✅ stream done — {event_count} events, {delta_count} deltas yielded")
    yield sse({"done": True})


def _extract_delta_text(delta_obj: Any) -> str | None:
    if not delta_obj:
        return None

    c = getattr(delta_obj, "content", None)
    if isinstance(c, str) and c:
        return c

    t = getattr(delta_obj, "text", None)
    if isinstance(t, str) and t:
        return t

    if isinstance(c, list):
        out = []
        for part in c:
            if isinstance(part, dict):
                if isinstance(part.get("text"), str):
                    out.append(part["text"])
            else:
                pt = getattr(part, "text", None)
                if isinstance(pt, str):
                    out.append(pt)
        joined = "".join(out).strip()
        return joined or None

    if isinstance(delta_obj, dict):
        if isinstance(delta_obj.get("content"), str) and delta_obj["content"]:
            return delta_obj["content"]
        if isinstance(delta_obj.get("text"), str) and delta_obj["text"]:
            return delta_obj["text"]
        c2 = delta_obj.get("content")
        if isinstance(c2, list):
            out = []
            for part in c2:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    out.append(part["text"])
            joined = "".join(out).strip()
            return joined or None

    return None


def gemini_stream(model_name: str, req: ChatRequest, images: List[Dict[str, str]] | None = None):
    images = images or []
    client = get_gemini_client()
    temp = get_temperature(req.model, req.temperature)

    if not images:
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
        return

    system_text, contents = build_gemini_contents_with_images(req.messages, images)

    cfg: Dict[str, Any] = {"temperature": temp}
    if system_text:
        cfg["system_instruction"] = system_text

    stream = client.models.generate_content_stream(
        model=model_name,
        contents=contents,
        config=cfg,
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
async def create_chat(req: CreateChatRequest, authorization: str | None = Header(default=None)):
    user_id = require_user_id_from_auth(authorization)

    if req.model not in MODEL_OPTIONS:
        raise HTTPException(400, f"Unsupported model: {req.model}")

    async with SessionLocal() as session:
        chat = ChatRow(user_id=user_id, model=req.model, title="New Chat", updated_at=utcnow())
        session.add(chat)
        await session.commit()
        await session.refresh(chat)
        return CreateChatResponse(chat_id=chat.id)


@app.get("/v1/chats", response_model=ChatListResponse)
async def list_chats(authorization: str | None = Header(default=None)):
    user_id = require_user_id_from_auth(authorization) 

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
async def delete_chat(chat_id: str, authorization: str | None = Header(default=None)):
    user_id = require_user_id_from_auth(authorization)

    async with SessionLocal() as session:
        chat = (await session.execute(
            select(ChatRow).where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
        )).scalars().first()

        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        await session.execute(delete(MessageRow).where(MessageRow.chat_id == chat_id))
        await session.delete(chat)
        await session.commit()
    return

    
@app.get("/v1/chats/{chat_id}", response_model=ChatWithMessagesResponse)
async def get_chat(chat_id: str, authorization: str | None = Header(default=None)):
    user_id = require_user_id_from_auth(authorization)  # 🔐 Firebase UID

    async with SessionLocal() as session:
        chat = (await session.execute(
            select(ChatRow)
            .where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
            .options(selectinload(ChatRow.messages))
        )).scalars().first()

        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        return ChatWithMessagesResponse(
            id=chat.id,
            title=chat.title,
            model=chat.model,
            messages=[ChatMsg(role=m.role, content=m.content) for m in chat.messages],
        )

import base64

async def split_uploads(files: list[UploadFile]) -> tuple[str, list[dict], list[str]]:
    """
    Returns:
      - file_context (string for text/pdf/code)
      - images (list of {filename, mime, b64})
      - filenames (all filenames)
    """
    if not files:
        return "", [], []

    chunks: list[str] = []
    images: list[dict] = []
    filenames: list[str] = []

    for f in files:
        name = f.filename or "file"
        filenames.append(name)

        ext = ("." + name.split(".")[-1]).lower() if "." in name else ""
        ctype = (f.content_type or "").lower()

        data = await f.read()
        if not data:
            continue

        if len(data) > MAX_FILE_BYTES:
            chunks.append(f"### File: {name}\n[Skipped: file too large]")
            continue

        # IMAGE
        if ext in ALLOWED_IMAGE_EXTS or ctype in ALLOWED_IMAGE_MIMES:
            if ctype not in ALLOWED_IMAGE_MIMES:
                if ext in (".jpg", ".jpeg"):
                    ctype = "image/jpeg"
                elif ext == ".png":
                    ctype = "image/png"
                elif ext == ".webp":
                    ctype = "image/webp"

            if ctype not in ALLOWED_IMAGE_MIMES:
                chunks.append(f"### File: {name}\n[Unsupported image mime: {ctype or 'unknown'}]")
                continue

            b64 = base64.b64encode(data).decode("utf-8")
            images.append({"filename": name, "mime": ctype, "b64": b64})
            continue

        if ext in ALLOWED_TEXT_EXTS:
            content =  read_upload_bytes_to_text(name, data)
            if content:
                chunks.append(f"### File: {name}\n{content}")
            continue

        chunks.append(f"### File: {name}\n[Unsupported file type: {ext or 'unknown'}]")

    file_context = ""
    if chunks:
        file_context = (
            "\n\n=== ATTACHED FILES ===\n\n"
            + "\n\n".join(chunks)
            + "\n\n=== END FILES ===\n"
        )

    return file_context, images, filenames

def read_upload_bytes_to_text(name: str, data: bytes) -> str:
    ext = ("." + name.split(".")[-1]).lower() if "." in name else ""

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


def build_file_task_prompt(user_message: str, file_context: str, filenames: list[str], has_images: bool) -> str:
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

## Notes about images
- If images are attached, analyze them too (UI screenshots, diagrams, photos, etc.).
- If text in an image is too small/blurred to read, say so.

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
    messages: str = Form("[]"),
    files: List[UploadFile] = File(default=[]),
    authorization: str | None = Header(default=None),
):
    user_id = require_user_id_from_auth(authorization)

    if model not in MODEL_OPTIONS:
        return StreamingResponse(
            iter([sse({"error": f"Unsupported model: {model}"}), sse({"done": True})]),
            media_type="text/event-stream",
        )

    try:
        parsed = json.loads(messages or "[]")
        req_msgs = [ChatMsg(**m) for m in parsed] if isinstance(parsed, list) else []
    except Exception:
        req_msgs = []

    has_files = len(files) > 0
    user_text = (message or "").strip()

    if not user_text and has_files:
        user_text = (
            "Please analyze the attached file(s).\n"
            "- Give a short overview\n"
            "- Identify key responsibilities\n"
            "- Point out potential bugs, edge cases, and improvements\n"
            "- Suggest refactors (with example code)\n"
        )

    if not user_text and not has_files:
        return StreamingResponse(
            iter([sse({"error": "Please type a message.", "error_short": "Please type a message."}), sse({"done": True})]),
            media_type="text/event-stream",
)

    file_context, images, filenames = await split_uploads(files) if has_files else ("", [], [])
    has_images = len(images) > 0

    if has_images and model not in VISION_MODELS:
        return StreamingResponse(
            iter([sse({"error": "Selected model doesn't support images. Please choose a vision model.",
                    "error_short": "Model doesn't support images."}),
                sse({"done": True})]),
            media_type="text/event-stream",
        )

    if has_files:
        user_payload = build_file_task_prompt(
            user_message=user_text,
            file_context=file_context,
            filenames=filenames,
            has_images=has_images,
        )
    else:
        user_payload = build_general_task_prompt(user_text)

    provider, model_name = parse_provider_model(model)

    # ----- Persist user msg + create assistant row -----
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

    # ----- Stream + flush into DB -----
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
                else:
                    print(f"[flush] ⚠️ assistant row {assistant_id} not found in DB!")

                chat2 = (await session.execute(
                    select(ChatRow).where(ChatRow.id == chat_id)
                )).scalars().first()
                if chat2:
                    chat2.updated_at = utcnow()

                await session.commit()
                print(f"[flush] ✅ flushed {len(chunk)} chars to DB (assistant_id={assistant_id})")

        try:
            async with SessionLocal() as session:
                chat = (await session.execute(
                    select(ChatRow)
                    .where(ChatRow.id == chat_id, ChatRow.user_id == user_id)
                    .options(selectinload(ChatRow.messages))
                )).scalars().first()

                if not chat:
                    print(f"[gen] ❌ chat {chat_id} not found for user {user_id}")
                    yield sse({"error": "Chat not found", "error_short": "Chat not found."})
                    yield sse({"done": True})
                    return

                raw_history = [
                    ChatMsg(role=m.role, content=m.content)
                    for m in chat.messages
                    if not (m.role == "assistant" and not (m.content or "").strip())
                ]

                print(f"[gen] raw_history ({len(raw_history)} msgs): "
                    + ", ".join(f"{m.role}:{len(m.content)}ch" for m in raw_history))

                history = raw_history
                replaced = False
                for i in range(len(history) - 1, -1, -1):
                    if history[i].role == "user":
                        print(f"[gen] replacing history[{i}] user msg with enriched payload "
                            f"({len(user_payload)} chars)")
                        history[i] = ChatMsg(role="user", content=user_payload)
                        replaced = True
                        break

                if not replaced:
                    print(f"[gen] no user msg found in history — appending payload")
                    history.append(ChatMsg(role="user", content=user_payload))

                print(f"[gen] final history ({len(history)} msgs): "
                    + ", ".join(f"{m.role}:{len(m.content)}ch" for m in history))

                llm_req = ChatRequest(
                    chat_id=chat_id,
                    model=model,
                    messages=history,
                    temperature=temperature,
                )

            print(f"[gen] 🚀 starting stream — provider={provider}, model={model_name}")

            loop = asyncio.get_event_loop()

            def sync_iter():
                if provider in ("openai", "openrouter", "groq", "nebius"):
                    yield from openai_stream(provider, model_name, llm_req, images=images)
                    return
                if provider == "anthropic":
                    yield from anthropic_stream(model_name, llm_req, images=images)
                    return
                if provider == "gemini":
                    yield from gemini_stream(model_name, llm_req, images=images)
                    return
                raise RuntimeError(f"Unknown provider: {provider}")

            it = iter(sync_iter())
            chunk_count = 0

            while True:
                try:
                    chunk = await loop.run_in_executor(None, lambda: next(it))
                except StopIteration:
                    print(f"[gen] stream exhausted after {chunk_count} SSE chunks")
                    break

                yield chunk
                chunk_count += 1

                if chunk.startswith("data: "):
                    payload = chunk[6:].strip()
                    try:
                        obj = json.loads(payload)
                    except Exception:
                        print(f"[gen] ⚠️ failed to parse SSE payload: {payload!r}")
                        obj = None

                    if isinstance(obj, dict) and obj.get("t"):
                        buffer_text += obj["t"]
                        if chunk_count <= 3:
                            print(f"[gen] first tokens: {obj['t']!r}")
                        await flush(False)

                    if isinstance(obj, dict) and obj.get("done"):
                        print(f"[gen] ✅ done signal received after {chunk_count} chunks")
                        await flush(True)
                        return

            await flush(True)
            yield sse({"done": True})

        except Exception as e:
            import traceback
            print(f"[gen] ❌ EXCEPTION: {type(e).__name__}: {e}")
            traceback.print_exc()
            try:
                await flush(True)
            except Exception as fe:
                print(f"[gen] ❌ flush also failed: {fe}")

            full = f"{type(e).__name__}: {str(e)}"
            yield sse({"error": full, "error_short": short_error_message(full)})
            yield sse({"done": True})

    return StreamingResponse(gen(), media_type="text/event-stream")