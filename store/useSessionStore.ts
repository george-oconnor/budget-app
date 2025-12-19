import { create } from "zustand";

type SessionStatus = "idle" | "loading" | "authenticated" | "error";

type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};

type SessionState = {
  user: SessionUser | null;
  token: string | null;
  status: SessionStatus;
  error: string | null;
  setSession: (payload: { user: SessionUser; token: string }) => void;
  setStatus: (status: SessionStatus) => void;
  setError: (message: string | null) => void;
  clearSession: () => void;
};

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
