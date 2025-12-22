import { create } from "zustand";
import type { Transaction } from "@/types/type";

interface TransactionDetailStore {
  selectedTransactionId: string | null;
  setSelectedTransactionId: (id: string | null) => void;
}

export const useTransactionDetailStore = create<TransactionDetailStore>((set) => ({
  selectedTransactionId: null,
  setSelectedTransactionId: (id) => set({ selectedTransactionId: id }),
}));
