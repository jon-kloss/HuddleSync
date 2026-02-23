import axios from "axios";
import { Config } from "../config";
import type { LoginResponse, HuddleSession, Team, User, PaginatedResponse, Summary } from "../types";

const api = axios.create({
  baseURL: Config.API_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          const { data } = await axios.post(`${Config.API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
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
};

export const teamsApi = {
  create: (name: string) =>
    api.post<Team>("/teams", { name }).then((r) => r.data),

  get: (id: string) =>
    api.get<Team>(`/teams/${id}`).then((r) => r.data),
};

export const usersApi = {
  getMe: () =>
    api.get<User>("/users/me").then((r) => r.data),
};

export default api;
