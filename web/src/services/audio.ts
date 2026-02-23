type AudioChunkCallback = (data: ArrayBuffer, sequenceNum: number) => void;

export class AudioCaptureService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private sequenceNum = 0;
  private onChunkCallback: AudioChunkCallback | null = null;

  onAudioChunk(callback: AudioChunkCallback): void {
    this.onChunkCallback = callback;
  }

  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.sequenceNum = 0;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        this.sequenceNum++;
        this.onChunkCallback?.(buffer, this.sequenceNum);
      }
    };

    this.mediaRecorder.start(5000);
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }

  pauseRecording(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.pause();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder?.state === "paused") {
      this.mediaRecorder.resume();
    }
  }
}
