"""Core diarization engine using pyannote.audio."""
import os
import numpy as np
import torch
from pyannote.audio import Pipeline, Model, Inference
from pyannote.core import Segment
from speaker_store import SpeakerStore


class DiarizeEngine:
    """Wraps pyannote.audio pipeline for speaker diarization and embedding extraction."""

    def __init__(self, hf_token: str, device: str = "cpu"):
        self.device = torch.device(device)

        self.pipeline = Pipeline.from_pretrained(
            os.getenv("MODEL_NAME", "pyannote/speaker-diarization-3.1"),
            use_auth_token=hf_token,
        )
        self.pipeline.to(self.device)

        embedding_model = Model.from_pretrained(
            os.getenv("EMBEDDING_MODEL", "pyannote/embedding"),
            use_auth_token=hf_token,
        )
        self.embedding_inference = Inference(
            embedding_model, window="whole", device=self.device
        )

        self.speaker_store = SpeakerStore()

    def diarize(self, wav_path: str, session_id: str, threshold: float = 0.65) -> list[dict]:
        """
        Run diarization on a WAV file.
        Returns list of segments with speaker_label, start_ms, end_ms, confidence.
        """
        diarization = self.pipeline(wav_path)

        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            start_ms = int(turn.start * 1000)
            end_ms = int(turn.end * 1000)

            # Try to match speaker to an enrolled user via embedding similarity
            try:
                segment_obj = Segment(turn.start, turn.end)
                embedding = self.embedding_inference.crop(wav_path, segment_obj)
                if isinstance(embedding, np.ndarray):
                    matched_user = self.speaker_store.find_match(embedding, threshold)
                    if matched_user:
                        speaker = matched_user
            except Exception:
                pass  # Fall back to pyannote's generic label

            segments.append({
                "speaker_label": speaker,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "confidence": 0.85,
            })

        return segments

    def extract_embedding(self, wav_path: str) -> np.ndarray:
        """Extract a speaker embedding from an audio file."""
        embedding = self.embedding_inference(wav_path)
        if isinstance(embedding, np.ndarray):
            return embedding
        return np.array(embedding)

    def enroll_speaker(self, user_id: str, wav_path: str) -> None:
        """Enroll a speaker by extracting and storing their voice embedding."""
        embedding = self.extract_embedding(wav_path)
        self.speaker_store.enroll(user_id, embedding)
