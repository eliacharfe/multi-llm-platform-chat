import os
from typing import List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json
from openai import OpenAI

load_dotenv()

app = FastAPI()


# Local dev CORS. Later we'll add your Vercel domain.
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

BASE_URLS = {
    "openai": None,
    "openrouter": os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    "groq": os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
}

TEMPERATURE_BY_MODEL = {
    # OpenAI GPT-5 family is strict. gpt-5-mini in your error supports only default (1),
    # so we simply don't send temperature.
    "gpt-5-mini": None,

    # You can decide defaults per model:
    "gpt-5": 0.7,

    # examples (edit as you add models)
    # "gpt-4o-mini": 0.7,
    # "deepseek/deepseek-chat": 0.7,
    # "llama-3.1-8b-instant": 0.7,
}

UNSUPPORTED_PARAMS_BY_MODEL = {
    # model_name: {"temperature", "top_p", ...}
    "gpt-5-mini": {"temperature"},
}


# ---- Model capabilities (add / tweak as you expand) ----

# If a model appears here, we will override incoming req.temperature
# If value is None => do NOT send temperature at all (use provider default)
TEMPERATURE_BY_MODEL = {
    # OpenAI GPT-5 family is strict. gpt-5-mini in your error supports only default (1),
    # so we simply don't send temperature.
    "gpt-5-mini": None,

    # You can decide defaults per model:
    "gpt-5": 0.7,

    # examples (edit as you add models)
    # "gpt-4o-mini": 0.7,
    # "deepseek/deepseek-chat": 0.7,
    # "llama-3.1-8b-instant": 0.7,
}

# Some providers/models reject certain params even when others accept them.
# Keep this minimal: add only when you actually hit an error.
UNSUPPORTED_PARAMS_BY_MODEL = {
    # model_name: {"temperature", "top_p", ...}
    "gpt-5-mini": {"temperature"},
}

def build_chat_params(model_name: str, req: "ChatRequest") -> dict:
    """
    Build OpenAI-compatible params safely by applying:
    - per-model temperature overrides
    - per-model param suppression (unsupported params)
    """
    params = {
        "model": model_name,
        "messages": [m.model_dump() for m in req.messages],
        "stream": True,
    }

    unsupported = UNSUPPORTED_PARAMS_BY_MODEL.get(model_name, set())

    # Decide temperature:
    # 1) If we have a per-model override, that wins (even if req has another value).
    # 2) Else use req.temperature (if provided).
    # 3) If unsupported, do not include it at all.
    temperature_override = TEMPERATURE_BY_MODEL.get(model_name, "__no_override__")

    if "temperature" not in unsupported:
        if temperature_override != "__no_override__":
            # None => don't send at all
            if temperature_override is not None:
                params["temperature"] = float(temperature_override)
        else:
            if req.temperature is not None:
                params["temperature"] = float(req.temperature)

    return params

def get_client(provider: str) -> OpenAI:
    provider = (provider or "").lower()

    if provider == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("Missing OPENAI_API_KEY")
        return OpenAI(api_key=key)

    if provider == "openrouter":
        key = os.getenv("OPENROUTER_API_KEY")
        if not key:
            raise RuntimeError("Missing OPENROUTER_API_KEY")
        return OpenAI(api_key=key, base_url=BASE_URLS["openrouter"])

    if provider == "groq":
        key = os.getenv("GROQ_API_KEY")
        if not key:
            raise RuntimeError("Missing GROQ_API_KEY")
        return OpenAI(api_key=key, base_url=BASE_URLS["groq"])

    raise RuntimeError(f"Unknown provider: {provider}")


class ChatMsg(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: str                # "provider:model_name"
    messages: List[ChatMsg]
    temperature: Optional[float] = 0.7


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/v1/chat/stream")
def chat_stream(req: ChatRequest):
    if ":" not in req.model:
        raise RuntimeError("Model must be like 'openai:gpt-5-mini'")

    provider, model_name = req.model.split(":", 1)
    client = get_client(provider)

    def gen():
        try:
            params = build_chat_params(model_name, req)

            stream = client.chat.completions.create(**params)

            for event in stream:
                token = (event.choices[0].delta.content or "")
                if token:
                    yield "data: " + json.dumps({"t": token}) + "\n\n"

            yield "data: " + json.dumps({"done": True}) + "\n\n"
        except Exception as e:
            yield f"data: ⚠️ {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")