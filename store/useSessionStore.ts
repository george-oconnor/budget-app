import {
  clearAllSessions,
  createAccount,
  createUserProfile,
  getCurrentSession,
  getCurrentUser,
  getUserProfile,
  signIn,
  signOut,
} from "@/lib/appwrite";
import { captureException, clearUser as clearSentryUser, setUser as setSentryUser } from "@/lib/sentry";
import type { SessionState } from "@/types/type";
import { create } from "zustand";

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = parts;
  const lastName = rest.join(" ");
  return { firstName, lastName };
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  status: "idle",
  error: null,
  
  checkSession: async () => {
    set({ status: "loading" });
    try {
      const [user, session] = await Promise.all([getCurrentUser(), getCurrentSession()]);
      
      if (!user || !session) {
        set({ user: null, token: null, status: "unauthenticated", error: null });
        return;
      }
      
      // Verify user profile exists in database
      const userProfile = await getUserProfile(user.$id);
      
      if (!userProfile) {
        // User has auth session but no profile - sign them out
        try {
          await clearAllSessions();
        } catch (e) {
          console.error("Failed to clear sessions:", e);
        }
        set({ user: null, token: null, status: "unauthenticated", error: null });
        return;
      }
      
      setSentryUser({ id: user.$id, email: user.email, username: user.name });
      set({ user: { id: user.$id, email: user.email, name: user.name }, token: session.$id, status: "authenticated", error: null });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to check session";
      console.error("Auth check failed:", errorMsg);
      captureException(err instanceof Error ? err : new Error(errorMsg));
      set({ user: null, token: null, status: "unauthenticated", error: errorMsg });
    }
  },

  login: async (email: string, password: string) => {
    set({ status: "loading", error: null });
    try {
      await signIn(email, password);
      const user = await getCurrentUser();
      if (user) {
        await getUserProfile(user.$id);
        setSentryUser({ id: user.$id, email: user.email, username: user.name });
        set({ user: { id: user.$id, email: user.email, name: user.name }, token: user.$id, status: "authenticated", error: null });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      captureException(err instanceof Error ? err : new Error(errorMsg), { email });
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  signup: async (email: string, password: string, name: string) => {
    set({ status: "loading", error: null });
    try {
      const authUser = await createAccount(email, password, name);
      await signIn(email, password);
      const { firstName, lastName } = splitName(name);
      
      // Create user profile in users table
      await createUserProfile(authUser.$id, email, firstName, lastName);
      
      const user = await getCurrentUser();
      if (user) {
        await getUserProfile(authUser.$id);
        setSentryUser({ id: user.$id, email: user.email, username: user.name });
        set({
          user: { id: user.$id, email: user.email, name: user.name },
          token: user.$id,
          status: "authenticated",
          error: null,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Signup failed";
      captureException(err instanceof Error ? err : new Error(errorMsg), { email, name });
      set({ status: "error", error: errorMsg });
      throw err;
    }
  },

  logout: async () => {
    try {
      await signOut();
    } catch (err) {
      // Log the error but don't fail - the user might be deleted or session invalid
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      captureException(err instanceof Error ? err : new Error(errorMsg));
      console.warn("Sign out failed, but clearing local session anyway:", errorMsg);
    } finally {
      // Always clear the local session, even if signOut failed
      clearSentryUser();
      set({ user: null, token: null, status: "unauthenticated", error: null });
    }
  },

  setSession: ({ user, token }) =>
    set({ user, token, status: "authenticated", error: null }),
  setStatus: (status) => set({ status }),
  setError: (message) => set({ error: message, status: "error" }),
  clearSession: () => set({ user: null, token: null, status: "idle", error: null }),
}));
