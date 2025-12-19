import type { SessionState } from "@/types/type";
import { create } from "zustand";

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  status: "idle",
  error: null,
  setSession: ({ user, token }) =>
    set({ user, token, status: "authenticated", error: null }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ error: message, status: "error" }),
  clearSession: () => set({ user: null, token: null, status: "idle", error: null }),
}));
