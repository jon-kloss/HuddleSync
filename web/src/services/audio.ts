type AudioChunkCallback = (data: ArrayBuffer, sequenceNum: number, mimeType: string) => void;

export class AudioCaptureService {
  private stream: MediaStream | null = null;
  private sequenceNum = 0;
  private activeMimeType = "audio/webm";
  private onChunkCallback: AudioChunkCallback | null = null;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;
  private currentRecorder: MediaRecorder | null = null;
  private isPaused = false;
  private isStopped = false;

  onAudioChunk(callback: AudioChunkCallback): void {
    this.onChunkCallback = callback;
  }

  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.sequenceNum = 0;
    this.isPaused = false;
    this.isStopped = false;

    this.activeMimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    // Start the first recording cycle
    this.startNewRecorder();

    // Every 5 seconds, stop the current recorder (triggering its data)
    // and start a fresh one so each chunk is a valid standalone file
    this.chunkInterval = setInterval(() => {
      if (!this.isPaused && !this.isStopped) {
        this.rotateRecorder();
      }
    }, 5000);
  }

  stopRecording(): void {
    this.isStopped = true;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.currentRecorder && this.currentRecorder.state !== "inactive") {
      this.currentRecorder.stop();
    }
    this.currentRecorder = null;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  pauseRecording(): void {
    this.isPaused = true;
    if (this.currentRecorder?.state === "recording") {
      this.currentRecorder.stop();
      this.currentRecorder = null;
    }
  }

  resumeRecording(): void {
    this.isPaused = false;
    if (!this.isStopped && this.stream) {
      this.startNewRecorder();
    }
  }

  private startNewRecorder(): void {
    if (!this.stream || this.isStopped) return;

    const recorder = new MediaRecorder(this.stream, { mimeType: this.activeMimeType });

    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        const buffer = await event.data.arrayBuffer();
        this.sequenceNum++;
        this.onChunkCallback?.(buffer, this.sequenceNum, this.activeMimeType);
      }
    };

    recorder.start();
    this.currentRecorder = recorder;
  }

  private rotateRecorder(): void {
    // Stop current recorder — this fires ondataavailable with a complete file
    if (this.currentRecorder && this.currentRecorder.state !== "inactive") {
      this.currentRecorder.stop();
    }
    // Start a fresh recorder so the next chunk gets its own WebM header
    this.startNewRecorder();
  }
}
