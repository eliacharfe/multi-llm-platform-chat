# # main.py
import json
import os
from typing import Any, Dict, List, Literal, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from clients import (
    get_openai_compatible_client,
    get_anthropic_client,
    get_gemini_client,
    openrouter_extra_headers,
)

load_dotenv()

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


@app.post("/v1/chat/stream")
def chat_stream(req: ChatRequest):
    provider, model_name = parse_provider_model(req.model)

    def gen():
        try:
            if req.model not in MODEL_OPTIONS:
                raise RuntimeError(f"Unsupported model: {req.model}")

            if provider in ("openai", "openrouter", "groq", "nebius"):
                yield from openai_stream(provider, model_name, req)
                return

            if provider == "anthropic":
                yield from anthropic_stream(model_name, req)
                return

            if provider == "gemini":
                yield from gemini_stream(model_name, req)
                return

            raise RuntimeError(f"Unknown provider: {provider}")
        except Exception as e:
            yield sse({"error": f"{type(e).__name__}: {str(e)}"})
            yield sse({"done": True})

    return StreamingResponse(gen(), media_type="text/event-stream")
# import json
# import os
# from typing import Any, Dict, List, Literal, Optional, Tuple

# from dotenv import load_dotenv
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import StreamingResponse
# from openai import OpenAI
# from pydantic import BaseModel

# load_dotenv()

# try:
#     import anthropic  # type: ignore
# except Exception:
#     anthropic = None

# try:
#     from google import genai  # type: ignore
# except Exception:
#     genai = None

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[
#         "http://localhost:3000",
#         "http://127.0.0.1:3000",
#     ],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# MODEL_OPTIONS = [
#     "openai:gpt-5-nano",
#     "openai:gpt-5-mini",
#     "openai:gpt-5",
#     "openrouter:deepseek/deepseek-chat",
#     "openrouter:x-ai/grok-4.1-fast",
#     "openrouter:openai/gpt-4o-mini",
#     "openrouter:mistralai/mistral-large-2512",
#     "groq:llama-3.1-8b-instant",
#     "groq:llama-3.3-70b-versatile",
#     "anthropic:claude-sonnet-4-6",
#     "anthropic:claude-opus-4-6",
#     "anthropic:claude-haiku-4-5",
#     "gemini:models/gemini-2.5-flash-lite",
#     "gemini:models/gemini-2.5-flash",
# ]

# DEFAULT_TEMPERATURE = 0.7

# TEMPERATURE_BY_MODEL: Dict[str, float] = {
#     "openrouter:deepseek/deepseek-chat": 0.7,
#     "openrouter:x-ai/grok-4.1-fast": 0.7,
#     "openrouter:openai/gpt-4o-mini": 0.7,
#     "openrouter:mistralai/mistral-large-2512": 0.6,
#     "groq:llama-3.1-8b-instant": 0.7,
#     "groq:llama-3.2-3b": 0.6,
#     "groq:llama-3.3-70b-versatile": 0.7,
#     "anthropic:claude-sonnet-4-6": 0.6,
#     "anthropic:claude-opus-4-6": 0.6,
#     "anthropic:claude-haiku-4-5": 0.7,
#     "gemini:models/gemini-2.5-flash-lite": 0.7,
#     "gemini:models/gemini-2.5-flash": 0.7,
# }

# BASE_URLS = {
#     "openai": None,
#     "openrouter": os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
#     "groq": os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
# }

# OPENROUTER_REFERRER = os.getenv("OPENROUTER_REFERRER", "")
# OPENROUTER_TITLE = os.getenv("OPENROUTER_TITLE", "")


# class ChatMsg(BaseModel):
#     role: Literal["system", "user", "assistant"]
#     content: str


# class ChatRequest(BaseModel):
#     model: str
#     messages: List[ChatMsg]
#     temperature: Optional[float] = None


# def sse_json(payload: Dict[str, Any]) -> str:
#     return "data: " + json.dumps(payload, ensure_ascii=False) + "\n\n"


# def parse_provider_model(provider_model: str) -> Tuple[str, str]:
#     if ":" not in provider_model:
#         raise RuntimeError("Model must be like 'provider:model_name'")
#     provider, model_name = provider_model.split(":", 1)
#     provider = (provider or "").strip().lower()
#     model_name = (model_name or "").strip()
#     if not provider or not model_name:
#         raise RuntimeError("Model must be like 'provider:model_name'")
#     return provider, model_name


# def get_temperature(provider_model: str, req_temperature: Optional[float]) -> float:
#     if provider_model in TEMPERATURE_BY_MODEL:
#         return float(TEMPERATURE_BY_MODEL[provider_model])
#     if req_temperature is not None:
#         return float(req_temperature)
#     return float(DEFAULT_TEMPERATURE)


# def openrouter_extra_headers() -> Optional[Dict[str, str]]:
#     headers: Dict[str, str] = {}
#     if OPENROUTER_REFERRER:
#         headers["HTTP-Referer"] = OPENROUTER_REFERRER
#     if OPENROUTER_TITLE:
#         headers["X-Title"] = OPENROUTER_TITLE
#     return headers or None


# def get_openai_compatible_client(provider: str) -> OpenAI:
#     if provider == "openai":
#         key = os.getenv("OPENAI_API_KEY")
#         if not key:
#             raise RuntimeError("Missing OPENAI_API_KEY")
#         return OpenAI(api_key=key)

#     if provider == "openrouter":
#         key = os.getenv("OPENROUTER_API_KEY")
#         if not key:
#             raise RuntimeError("Missing OPENROUTER_API_KEY")
#         return OpenAI(api_key=key, base_url=BASE_URLS["openrouter"])

#     if provider == "groq":
#         key = os.getenv("GROQ_API_KEY")
#         if not key:
#             raise RuntimeError("Missing GROQ_API_KEY")
#         return OpenAI(api_key=key, base_url=BASE_URLS["groq"])

#     raise RuntimeError(f"Unknown provider: {provider}")


# def get_anthropic_client():
#     if anthropic is None:
#         raise RuntimeError("anthropic package is not installed")
#     key = os.getenv("ANTHROPIC_API_KEY")
#     if not key:
#         raise RuntimeError("Missing ANTHROPIC_API_KEY")
#     return anthropic.Anthropic(api_key=key)


# def get_gemini_client():
#     if genai is None:
#         raise RuntimeError("google-genai package is not installed")
#     key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
#     if not key:
#         raise RuntimeError("Missing GEMINI_API_KEY (or GOOGLE_API_KEY)")
#     return genai.Client(api_key=key)


# def sanitize_openai_messages(raw: List[ChatMsg]) -> List[Dict[str, str]]:
#     out: List[Dict[str, str]] = []
#     for m in raw or []:
#         if m.role not in ("system", "user", "assistant"):
#             continue
#         out.append({"role": m.role, "content": m.content or ""})
#     return out


# def split_system_and_chat(messages: List[ChatMsg]) -> Tuple[str, List[Dict[str, str]]]:
#     system_parts: List[str] = []
#     chat: List[Dict[str, str]] = []
#     for m in messages or []:
#         if m.role == "system":
#             if m.content:
#                 system_parts.append(m.content)
#         elif m.role in ("user", "assistant"):
#             chat.append({"role": m.role, "content": m.content or ""})
#     return "\n\n".join(system_parts).strip(), chat


# def build_gemini_prompt(messages: List[ChatMsg]) -> str:
#     lines: List[str] = []
#     for m in messages or []:
#         if m.role == "system":
#             if m.content:
#                 lines.append(f"System: {m.content.strip()}")
#         elif m.role == "user":
#             txt = (m.content or "").strip()
#             if txt:
#                 lines.append(f"User: {txt}")
#         elif m.role == "assistant":
#             txt = (m.content or "").strip()
#             if txt:
#                 lines.append(f"Assistant: {txt}")
#     lines.append("Assistant:")
#     prompt = "\n".join(lines).strip()
#     return prompt


# @app.get("/health")
# def health():
#     return {"ok": True}


# @app.post("/v1/chat/stream")
# def chat_stream(req: ChatRequest):
#     provider, model_name = parse_provider_model(req.model)

#     def gen():
#         try:
#             temp = get_temperature(req.model, req.temperature)

#             if provider in ("openai", "openrouter", "groq"):
#                 client = get_openai_compatible_client(provider)
#                 messages = sanitize_openai_messages(req.messages)

#                 create_kwargs: Dict[str, Any] = {
#                     "model": model_name,
#                     "messages": messages,
#                     "stream": True,
#                 }

#                 if provider == "openrouter":
#                     extra = openrouter_extra_headers()
#                     if extra:
#                         create_kwargs["extra_headers"] = extra

#                 if provider == "openai" and model_name.startswith("gpt-5"):
#                     create_kwargs["max_completion_tokens"] = 2048
#                 else:
#                     create_kwargs["max_tokens"] = 2048
#                     create_kwargs["temperature"] = temp

#                 stream = client.chat.completions.create(**create_kwargs)

#                 for event in stream:
#                     delta = getattr(event.choices[0].delta, "content", None)
#                     if delta:
#                         yield sse_json({"t": delta})

#                 yield sse_json({"done": True})
#                 return

#             if provider == "anthropic":
#                 client = get_anthropic_client()
#                 system_text, chat = split_system_and_chat(req.messages)

#                 out = ""
#                 with client.messages.stream(
#                     model=model_name,
#                     max_tokens=2048,
#                     temperature=temp,
#                     system=system_text or None,
#                     messages=chat,
#                 ) as stream:
#                     for text in stream.text_stream:
#                         if text:
#                             out += text
#                             yield sse_json({"t": text})

#                 yield sse_json({"done": True})
#                 return

#             if provider == "gemini":
#                 client = get_gemini_client()
#                 prompt = build_gemini_prompt(req.messages)

#                 stream = client.models.generate_content_stream(
#                     model=model_name,
#                     contents=prompt,
#                     config={"temperature": temp},
#                 )

#                 for chunk in stream:
#                     text = getattr(chunk, "text", None)
#                     if text:
#                         yield sse_json({"t": text})

#                 yield sse_json({"done": True})
#                 return

#             raise RuntimeError(f"Unknown provider: {provider}")

#         except Exception as e:
#             yield sse_json({"error": f"{type(e).__name__}: {str(e)}"})
#             yield sse_json({"done": True})

#     return StreamingResponse(gen(), media_type="text/event-stream")
