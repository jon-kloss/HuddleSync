"""FastAPI diarization microservice using pyannote.audio."""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from audio_utils import convert_to_wav
from diarize_engine import DiarizeEngine

load_dotenv()

engine: DiarizeEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup."""
    global engine
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError("HF_TOKEN environment variable is required")

    device = os.getenv("DEVICE", "cpu")
    print("[Diarization] Loading models...")
    engine = DiarizeEngine(hf_token=hf_token, device=device)
    print("[Diarization] Models loaded successfully")
    yield
    print("[Diarization] Shutting down")


app = FastAPI(
    title="HuddleSync Diarization Service",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": engine is not None}


@app.post("/diarize")
async def diarize(
    audio: UploadFile = File(...),
    session_id: str = Form(...),
    threshold: str = Form("0.65"),
):
    """
    Diarize an audio chunk.
    Accepts any audio format (webm, wav, mp4, etc.).
    Returns speaker segments with timing.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        threshold_val = float(threshold)
    except ValueError:
        threshold_val = 0.65

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    content_type = audio.content_type or "audio/webm"

    wav_path = None
    try:
        wav_path = convert_to_wav(audio_bytes, source_format=content_type)
        segments = engine.diarize(wav_path, session_id, threshold_val)
        return JSONResponse(content={"segments": segments})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diarization failed: {str(e)}")
    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)


@app.post("/enroll")
async def enroll(
    audio: UploadFile = File(...),
    user_id: str = Form(...),
):
    """
    Enroll a speaker's voice for identification.
    Accepts any audio format.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    content_type = audio.content_type or "audio/wav"

    wav_path = None
    try:
        wav_path = convert_to_wav(audio_bytes, source_format=content_type)
        engine.enroll_speaker(user_id, wav_path)
        return JSONResponse(content={"status": "enrolled", "user_id": user_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")
    finally:
        if wav_path and os.path.exists(wav_path):
            os.unlink(wav_path)
