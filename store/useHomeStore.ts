import { create } from "zustand";

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
};

type HomeState = {
  summary: Summary | null;
  categories: Category[];
  selectedCategory: string;
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  fetchHome: () => Promise<void>;
  setCategory: (id: string) => void;
};

const mockCategories: Category[] = [
  { id: "all", name: "All", color: "#2F9B65" },
  { id: "food", name: "Food", color: "#FE8C00" },
  { id: "shopping", name: "Shopping", color: "#6C63FF" },
  { id: "transport", name: "Transport", color: "#0C8CE9" },
  { id: "bills", name: "Bills", color: "#F14141" },
];

const mockTransactions: Transaction[] = [
  {
    id: "t-1",
    title: "Groceries",
    subtitle: "Trader Joe's",
    amount: -64.32,
    categoryId: "food",
    kind: "expense",
    date: "2024-12-19T15:30:00.000Z",
  },
  {
    id: "t-2",
    title: "Paycheck",
    subtitle: "Monthly salary",
    amount: 3200,
    categoryId: "income",
    kind: "income",
    date: "2024-12-18T09:00:00.000Z",
  },
  {
    id: "t-3",
    title: "Metro pass",
    subtitle: "Transit",
    amount: -45.0,
    categoryId: "transport",
    kind: "expense",
    date: "2024-12-17T08:10:00.000Z",
  },
  {
    id: "t-4",
    title: "Electric bill",
    subtitle: "Utilities",
    amount: -120.5,
    categoryId: "bills",
    kind: "expense",
    date: "2024-12-16T12:00:00.000Z",
  },
];

const mockSummary: Summary = {
  balance: 12450.23,
  income: 5200,
  expenses: 2650,
  currency: "USD",
};

export const useHomeStore = create<HomeState>((set) => ({
  summary: null,
  categories: mockCategories,
  selectedCategory: "all",
  transactions: [],
  loading: false,
  error: null,
  fetchHome: async () => {
    set({ loading: true, error: null });
    try {
      // TODO: Replace mock data with Appwrite fetch when backend is wired.
      await new Promise((resolve) => setTimeout(resolve, 120));
      set({ summary: mockSummary, transactions: mockTransactions, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load home data", loading: false });
    }
  },
  setCategory: (id) => set({ selectedCategory: id || "all" }),
}));
