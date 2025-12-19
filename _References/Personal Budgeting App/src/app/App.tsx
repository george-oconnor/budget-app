import { useState, useEffect } from "react";
import { BalanceCard } from "./components/BalanceCard";
import { AccountsCard } from "./components/AccountsCard";
import { TransactionList } from "./components/TransactionList";
import { SpendingChart } from "./components/SpendingChart";
import { AddTransactionSheet, Transaction } from "./components/AddTransactionSheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ChartPie, Calendar } from "lucide-react";

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Load transactions from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("budget-transactions");
    if (stored) {
      try {
        setTransactions(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load transactions:", error);
      }
    }
  }, []);

  // Save transactions to localStorage whenever they change
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem("budget-transactions", JSON.stringify(transactions));
    }
  }, [transactions]);

  const handleAddTransaction = (transaction: Omit<Transaction, "id">) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString(),
    };
    setTransactions((prev) => [...prev, newTransaction]);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <h1>Budget Tracker</h1>
          <p className="text-muted-foreground">
            Manage your personal finances
          </p>
        </div>

        <BalanceCard transactions={transactions} />
        
        <AccountsCard transactions={transactions} />

        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <ChartPie className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="transactions" className="mt-6">
            <TransactionList transactions={transactions} />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6">
            <SpendingChart transactions={transactions} />
          </TabsContent>
        </Tabs>
      </div>

      <AddTransactionSheet onAdd={handleAddTransaction} />
    </div>
  );
}