import { getCategories, getMonthlyBudget, getTransactionsForMonth } from "@/lib/appwrite";
import { captureException } from "@/lib/sentry";
import type { Category, Summary, Transaction } from "@/types/type";
import { create } from "zustand";
import { useSessionStore } from "./useSessionStore";

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
    amount: -6432,
    categoryId: "food",
    kind: "expense",
    date: "2024-12-19T15:30:00.000Z",
  },
  {
    id: "t-2",
    title: "Paycheck",
    subtitle: "Monthly salary",
    amount: 320000,
    categoryId: "income",
    kind: "income",
    date: "2024-12-18T09:00:00.000Z",
  },
  {
    id: "t-3",
    title: "Metro pass",
    subtitle: "Transit",
    amount: -4500,
    categoryId: "transport",
    kind: "expense",
    date: "2024-12-17T08:10:00.000Z",
  },
  {
    id: "t-4",
    title: "Electric bill",
    subtitle: "Utilities",
    amount: -12050,
    categoryId: "bills",
    kind: "expense",
    date: "2024-12-16T12:00:00.000Z",
  },
];

const mockSummary: Summary = {
  balance: 1245023,
  income: 520000,
  expenses: 265000,
  currency: "USD",
  monthlyBudget: 300000,
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
      const now = new Date();
      const user = useSessionStore.getState().user;
      const userId = user?.id || "demo-user";

      const envOk = Boolean(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT && process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID);
      if (!envOk) {
        // Fallback to mock if env not configured
        await new Promise((resolve) => setTimeout(resolve, 120));
        set({ summary: mockSummary, transactions: mockTransactions, loading: false });
        return;
      }

      const [budgetDoc, txDocs, catDocs] = await Promise.all([
        getMonthlyBudget(userId),
        getTransactionsForMonth(userId, now.getUTCFullYear(), now.getUTCMonth()),
        getCategories().catch(() => []),
      ]);

      const income = txDocs.filter((t) => t.kind === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = txDocs.filter((t) => t.kind === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

      const summary: Summary = {
        balance: income - expenses,
        income,
        expenses,
        currency: budgetDoc.currency || "USD",
        monthlyBudget: budgetDoc.monthlyBudget || 0,
      };

      // Map TransactionDoc -> Transaction
      const transactions: Transaction[] = txDocs.map((t) => ({
        id: (t as any).$id ?? `${t.userId}-${t.date}`,
        title: t.title,
        subtitle: t.subtitle || "",
        amount: t.amount,
        categoryId: t.categoryId,
        kind: t.kind,
        date: t.date,
      }));

      // Map CategoryDoc -> Category
      const categories: Category[] = (catDocs as any[]).map((c) => ({
        id: c.$id,
        name: c.name,
        color: c.color,
        icon: c.icon,
      }));

      // Add "All" category at the beginning
      const allCategories: Category[] = [
        { id: "all", name: "All", color: "#2F9B65" },
        ...(categories.length ? categories : mockCategories.slice(1)), // Exclude mock "All" if using real categories
      ];

      set({ summary, transactions, categories: allCategories, loading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load home data";
      console.warn("❌ Fetch home data failed:", errorMsg, err);
      captureException(err instanceof Error ? err : new Error(errorMsg), { userId: "demo-user" });
      set({ error: errorMsg, loading: false });
    }
  },
  setCategory: (id) => set({ selectedCategory: id || "all" }),
}));
