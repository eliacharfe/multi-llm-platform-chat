
# apps/api/routers/voice.py

from fastapi import APIRouter, UploadFile, File, HTTPException, Header, Form
from fastapi.responses import JSONResponse
from openai import AsyncOpenAI
import os

router = APIRouter(prefix="/v1/voice", tags=["voice"])

def _get_openai_client() -> AsyncOpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    return AsyncOpenAI(api_key=key)

def _to_whisper_lang(browser_lang: str) -> str | None:
    if not browser_lang:
        return None
    # "he-IL" → "he", "en-US" → "en", etc.
    code = browser_lang.split("-")[0].lower().strip()
    return code if len(code) == 2 else None


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    lang: str = Form(default=""),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization Bearer token")

    import firebase_admin.auth as fb_auth
    try:
        decoded = fb_auth.verify_id_token(authorization.split(" ", 1)[1].strip())
        if not decoded.get("uid"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid/expired token")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    whisper_lang = _to_whisper_lang(lang)
    print(f"[voice] lang={lang!r} → whisper_lang={whisper_lang!r}")

    try:
        client = _get_openai_client()
        kwargs: dict = dict(
            model="whisper-1",
            file=(file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm"),
            response_format="text",  # plain text, no post-processing or auto-translation
        )
        if whisper_lang:
            kwargs["language"] = whisper_lang  # forces Whisper to transcribe in this language

        transcript = await client.audio.transcriptions.create(**kwargs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    text = transcript if isinstance(transcript, str) else transcript.text
    return JSONResponse({"transcript": text})
