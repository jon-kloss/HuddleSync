const DEV_API_URL = "http://localhost:3001/api/v1";
const PROD_API_URL = "https://api.huddlesync.com/api/v1";
const DEV_WS_URL = "http://localhost:3001";
const PROD_WS_URL = "https://api.huddlesync.com";

export const Config = {
  API_URL: __DEV__ ? DEV_API_URL : PROD_API_URL,
  WS_URL: __DEV__ ? DEV_WS_URL : PROD_WS_URL,
  AUDIO_CHUNK_INTERVAL_MS: 5000,
  AUDIO_SAMPLE_RATE: 16000,
  AUDIO_CHANNELS: 1,
  AUDIO_BIT_DEPTH: 16,
};

export const Colors = {
  primary: "#4A90D9",
  primaryDark: "#3A7BC8",
  secondary: "#2C3E50",
  background: "#F5F7FA",
  card: "#FFFFFF",
  text: "#2C3E50",
  textSecondary: "#7F8C8D",
  border: "#E0E4E8",
  error: "#E74C3C",
  success: "#27AE60",
  warning: "#F39C12",
  white: "#FFFFFF",
  black: "#000000",
  overlay: "rgba(0,0,0,0.5)",
};
