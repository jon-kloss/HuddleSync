import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { authApi, usersApi } from "../services/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const response = await authApi.login(email, password);
    await SecureStore.setItemAsync("accessToken", response.accessToken);
    await SecureStore.setItemAsync("refreshToken", response.refreshToken);
    set({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isAuthenticated: true,
    });
  },

  register: async (email, password, displayName) => {
    const response = await authApi.register(email, password, displayName);
    await SecureStore.setItemAsync("accessToken", response.accessToken);
    await SecureStore.setItemAsync("refreshToken", response.refreshToken);
    set({
      user: response.user,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      const refreshToken = await SecureStore.getItemAsync("refreshToken");

      if (accessToken) {
        const user = await usersApi.getMe();
        set({
          user: user as any,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      set({ isLoading: false });
    }
  },
}));
