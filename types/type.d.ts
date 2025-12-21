export type Category = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
};

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  categoryId: string;
  kind: "income" | "expense";
  date: string;
};

export type Summary = {
  balance: number;
  income: number;
  expenses: number;
  currency: string;
  monthlyBudget: number;
};

export type QuickAction = {
  id: string;
  label: string;
  icon: string; // icon name from Feather glyphMap
};

export type SessionStatus = "idle" | "loading" | "authenticated" | "unauthenticated" | "error";

export type SessionUser = {
  id: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export type SessionState = {
  user: SessionUser | null;
  token: string | null;
  status: SessionStatus;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (payload: { user: SessionUser; token: string }) => void;
  setStatus: (status: SessionStatus) => void;
  setError: (message: string | null) => void;
  clearSession: () => void;
};
