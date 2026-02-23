import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Config } from "../constants/config";

type AudioChunkCallback = (data: string, sequenceNum: number, tempFileUri: string) => void;

export class AudioCaptureService {
  private recording: Audio.Recording | null = null;
  private chunkInterval: ReturnType<typeof setInterval> | null = null;
  private sequenceNum = 0;
  private isCapturing = false;
  private onChunkCallback: AudioChunkCallback | null = null;

  async requestPermissions(): Promise<boolean> {
    const { status } = await Audio.requestPermissionsAsync();
    return status === "granted";
  }

  onAudioChunk(callback: AudioChunkCallback): void {
    this.onChunkCallback = callback;
  }

  async startRecording(): Promise<void> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      throw new Error("Microphone permission not granted");
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    this.sequenceNum = 0;
    this.isCapturing = true;
    await this.startChunkCapture();
  }

  async stopRecording(): Promise<void> {
    this.isCapturing = false;

    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }

    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // Recording may already be stopped
      }
      this.recording = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
  }

  async pauseRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.pauseAsync();
    }
    if (this.chunkInterval) {
      clearInterval(this.chunkInterval);
      this.chunkInterval = null;
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.startAsync();
    }
    this.startChunkInterval();
  }

  private async startChunkCapture(): Promise<void> {
    await this.startNewRecording();
    this.startChunkInterval();
  }

  private startChunkInterval(): void {
    this.chunkInterval = setInterval(async () => {
      if (!this.isCapturing) return;
      await this.captureChunk();
    }, Config.AUDIO_CHUNK_INTERVAL_MS);
  }

  private async startNewRecording(): Promise<void> {
    const recordingOptions: Audio.RecordingOptions = {
      android: {
        extension: ".wav",
        outputFormat: Audio.AndroidOutputFormat.DEFAULT,
        audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
        sampleRate: Config.AUDIO_SAMPLE_RATE,
        numberOfChannels: Config.AUDIO_CHANNELS,
        bitRate: Config.AUDIO_SAMPLE_RATE * Config.AUDIO_BIT_DEPTH * Config.AUDIO_CHANNELS,
      },
      ios: {
        extension: ".wav",
        audioQuality: Audio.IOSAudioQuality.HIGH,
        sampleRate: Config.AUDIO_SAMPLE_RATE,
        numberOfChannels: Config.AUDIO_CHANNELS,
        bitRate: Config.AUDIO_SAMPLE_RATE * Config.AUDIO_BIT_DEPTH * Config.AUDIO_CHANNELS,
        linearPCMBitDepth: Config.AUDIO_BIT_DEPTH,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: "audio/wav",
        bitsPerSecond: Config.AUDIO_SAMPLE_RATE * Config.AUDIO_BIT_DEPTH * Config.AUDIO_CHANNELS,
      },
    };

    const { recording } = await Audio.Recording.createAsync(recordingOptions);
    this.recording = recording;
  }

  private async captureChunk(): Promise<void> {
    if (!this.recording) return;

    try {
      // Stop current recording
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      // Start new recording immediately for seamless capture
      await this.startNewRecording();

      // Read the recorded file as base64
      if (uri) {
        const base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        this.sequenceNum += 1;
        this.onChunkCallback?.(base64Data, this.sequenceNum, uri);
      }
    } catch (err) {
      console.error("[Audio] Failed to capture chunk:", err);
    }
  }
}
