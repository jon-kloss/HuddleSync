"""In-memory speaker embedding store with filesystem persistence."""
import os
import numpy as np
from pathlib import Path

DEFAULT_STORAGE = os.getenv("SPEAKER_STORAGE_DIR", os.path.join(os.path.dirname(__file__), "speaker_data"))


class SpeakerStore:
    """Stores enrolled speaker embeddings for matching."""

    def __init__(self, storage_dir: str = DEFAULT_STORAGE):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.embeddings: dict[str, np.ndarray] = {}
        self._load_from_disk()

    def enroll(self, user_id: str, embedding: np.ndarray) -> None:
        """Store or update a speaker embedding."""
        self.embeddings[user_id] = embedding
        self._save_to_disk(user_id, embedding)

    def find_match(self, embedding: np.ndarray, threshold: float = 0.65) -> str | None:
        """Find the best matching enrolled speaker above the threshold."""
        if not self.embeddings:
            return None

        best_user_id = None
        best_score = -1.0

        for user_id, stored_emb in self.embeddings.items():
            score = self._cosine_similarity(embedding, stored_emb)
            if score > best_score:
                best_score = score
                best_user_id = user_id

        if best_score >= threshold:
            return best_user_id
        return None

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def _save_to_disk(self, user_id: str, embedding: np.ndarray) -> None:
        path = self.storage_dir / f"{user_id}.npy"
        np.save(str(path), embedding)

    def _load_from_disk(self) -> None:
        for npy_file in self.storage_dir.glob("*.npy"):
            user_id = npy_file.stem
            self.embeddings[user_id] = np.load(str(npy_file))
