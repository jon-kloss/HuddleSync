"""Audio format conversion utilities."""
import os
import tempfile
from pydub import AudioSegment

MIME_TO_FORMAT = {
    "audio/webm;codecs=opus": "webm",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}


def convert_to_wav(audio_bytes: bytes, source_format: str = "webm") -> str:
    """
    Convert audio bytes to a temporary 16kHz mono WAV file.
    Returns the path to the temporary WAV file.
    Caller is responsible for cleanup via os.unlink().
    """
    fmt = MIME_TO_FORMAT.get(source_format, source_format)

    if fmt == "wav":
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.write(audio_bytes)
        tmp.close()
        return tmp.name

    # Write source bytes to temp file for pydub to read
    src_tmp = tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False)
    src_tmp.write(audio_bytes)
    src_tmp.close()

    try:
        audio = AudioSegment.from_file(src_tmp.name, format=fmt)
        audio = audio.set_frame_rate(16000).set_channels(1)

        dst_tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        audio.export(dst_tmp.name, format="wav")
        dst_tmp.close()
        return dst_tmp.name
    finally:
        os.unlink(src_tmp.name)
