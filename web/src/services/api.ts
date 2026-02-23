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

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  for (const prom of failedQueue) {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  }
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while a refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const { data } = await axios.post(`${Config.API_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        // Update the auth store in-memory state
        const { useAuthStore } = await import("../stores/authStore");
        useAuthStore.setState({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Clear everything and force logout
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        const { useAuthStore } = await import("../stores/authStore");
        useAuthStore.getState().logout();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
