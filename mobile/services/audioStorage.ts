import * as FileSystem from "expo-file-system";

const AUDIO_BASE_DIR = `${FileSystem.documentDirectory}audio/`;

export class AudioStorageService {
  async ensureSessionDir(sessionId: string): Promise<string> {
    const sessionDir = `${AUDIO_BASE_DIR}${sessionId}/`;
    const dirInfo = await FileSystem.getInfoAsync(sessionDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(sessionDir, { intermediates: true });
    }
    return sessionDir;
  }

  async saveChunk(sessionId: string, sequenceNum: number, tempUri: string): Promise<string> {
    const sessionDir = await this.ensureSessionDir(sessionId);
    const paddedSeq = String(sequenceNum).padStart(4, "0");
    const destUri = `${sessionDir}chunk_${paddedSeq}.wav`;
    await FileSystem.moveAsync({ from: tempUri, to: destUri });
    return destUri;
  }

  async listChunks(sessionId: string): Promise<string[]> {
    const sessionDir = `${AUDIO_BASE_DIR}${sessionId}/`;
    const dirInfo = await FileSystem.getInfoAsync(sessionDir);
    if (!dirInfo.exists) return [];
    const files = await FileSystem.readDirectoryAsync(sessionDir);
    return files
      .filter((f) => f.endsWith(".wav"))
      .sort()
      .map((f) => `${sessionDir}${f}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionDir = `${AUDIO_BASE_DIR}${sessionId}/`;
    const dirInfo = await FileSystem.getInfoAsync(sessionDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(sessionDir, { idempotent: true });
    }
  }
}
