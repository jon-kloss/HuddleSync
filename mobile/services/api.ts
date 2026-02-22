import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Config } from "../constants/config";
import type { LoginResponse, HuddleSession, Team, User, PaginatedResponse, Summary } from "../types";

const api = axios.create({
  baseURL: Config.API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");
        if (refreshToken) {
          const { data } = await axios.post(`${Config.API_URL}/auth/refresh`, { refreshToken });
          await SecureStore.setItemAsync("accessToken", data.accessToken);
          await SecureStore.setItemAsync("refreshToken", data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>("/auth/login", { email, password }).then((r) => r.data),

  register: (email: string, password: string, displayName: string) =>
    api.post<LoginResponse>("/auth/register", { email, password, displayName }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post("/auth/refresh", { refreshToken }).then((r) => r.data),
};

export const sessionsApi = {
  create: (teamId: string) =>
    api.post<HuddleSession>("/sessions", { teamId }).then((r) => r.data),

  get: (id: string) =>
    api.get<HuddleSession>(`/sessions/${id}`).then((r) => r.data),

  end: (id: string) =>
    api.patch<HuddleSession>(`/sessions/${id}/end`).then((r) => r.data),

  getSummary: (id: string) =>
    api.get<Summary>(`/sessions/${id}/summary`).then((r) => r.data),

  listForTeam: (teamId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<HuddleSession>>(`/sessions/team/${teamId}`, { params: { page, limit } }).then((r) => r.data),

  mapSpeaker: (sessionId: string, label: string, userId: string) =>
    api.put(`/sessions/${sessionId}/speakers/${label}`, { userId }).then((r) => r.data),
};

export const teamsApi = {
  create: (name: string) =>
    api.post<Team>("/teams", { name }).then((r) => r.data),

  get: (id: string) =>
    api.get<Team>(`/teams/${id}`).then((r) => r.data),

  addMember: (teamId: string, email: string, role = "MEMBER") =>
    api.post(`/teams/${teamId}/members`, { email, role }).then((r) => r.data),

  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`).then((r) => r.data),
};

export const usersApi = {
  getMe: () =>
    api.get<User>("/users/me").then((r) => r.data),

  updateProfile: (data: { displayName?: string }) =>
    api.patch<User>("/users/me", data).then((r) => r.data),

  uploadVoiceEnrollment: (audioUri: string) => {
    const formData = new FormData();
    formData.append("audio", { uri: audioUri, type: "audio/wav", name: "enrollment.wav" } as any);
    return api.post("/users/me/voice-enrollment", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
};

export default api;
