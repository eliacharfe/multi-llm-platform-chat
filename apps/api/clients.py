# clients.py
import os
from openai import OpenAI
import anthropic
from google import genai
from functools import lru_cache

BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "groq": "https://api.groq.com/openai/v1",
    "nebius": "https://api.tokenfactory.nebius.com/v1",
}

@lru_cache(maxsize=16)
def get_openai_compatible_client(provider: str) -> OpenAI:
    """
    Returns an OpenAI-compatible client for providers:
    openai, openrouter, groq, nebius (and any others you add)
    """
    provider = (provider or "").lower()

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("Missing OPENAI_API_KEY in .env")
        return OpenAI(api_key=api_key)

    if provider == "openrouter":
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("Missing OPENROUTER_API_KEY in .env")
        return OpenAI(api_key=api_key, base_url=BASE_URLS["openrouter"])

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("Missing GROQ_API_KEY in .env")
        return OpenAI(api_key=api_key, base_url=BASE_URLS["groq"])

    if provider == "nebius":
        api_key = os.getenv("NEBIUS_API_KEY")
        if not api_key:
            raise RuntimeError("Missing NEBIUS_API_KEY in .env")
        return OpenAI(api_key=api_key, base_url=BASE_URLS["nebius"])

    raise RuntimeError(f"Unknown OpenAI-compatible provider: {provider}")


def get_anthropic_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("Missing ANTHROPIC_API_KEY in .env")
    return anthropic.Anthropic(api_key=api_key)


def get_gemini_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in .env")
    return genai.Client(api_key=api_key)


def openrouter_extra_headers() -> dict:
    """
    Optional but recommended by OpenRouter for attribution.
    """
    h = {}
    ref = os.getenv("OPENROUTER_HTTP_REFERER")
    title = os.getenv("OPENROUTER_X_TITLE")
    if ref:
        h["HTTP-Referer"] = ref
    if title:
        h["X-Title"] = title
    return h
