import { getAccountBalances } from "@/lib/accountBalances";
import { updateAccountBalance } from "@/lib/accountBalances";
import { getAllTransactionsForUser } from "@/lib/appwrite";
import { detectTransferPairs, markTransfers } from "@/lib/csvParser";
import { queueTransactionsForSync } from "@/lib/syncQueue";
import { useHomeStore } from "@/store/useHomeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearParsedTransactions, getParsedTransactions } from "./paste";

interface Transaction {
  title: string;
  subtitle: string;
  amount: number;
  kind: "income" | "expense";
  date: string;
  categoryId: string;
  currency: string;
  excludeFromAnalytics?: boolean;
  isAnalyticsProtected?: boolean;
}

// Helpers for robust deduping (normalize text, amount, and date to a stable key)
const normalizeText = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const normalizeDateToISO = (value: string) => {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return (value || "").trim();
  return new Date(t).toISOString();
};
const makeKeyFromTransaction = (t: Transaction) =>
  `${normalizeText(t.title)}|${Math.abs(t.amount)}|${t.kind}|${t.date}`;
const makeKeyFromDoc = (doc: any) =>
  `${normalizeText(doc.title || "")}|${Math.abs(Number(doc.amount))}|${doc.kind}|${doc.date || ""}`;

export default function ImportPreviewScreen() {
  const { user } = useSessionStore();
  const { fetchHome } = useHomeStore();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [skippedCount, setSkippedCount] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [preSkippedCount, setPreSkippedCount] = useState(0);
  const [preUniqueCount, setPreUniqueCount] = useState(0);
  const [precheckDone, setPrecheckDone] = useState(false);
  const [duplicateKeys, setDuplicateKeys] = useState<Set<string>>(new Set());
  const [parseStats, setParseStats] = useState<{
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    skippedDetails: { line: number; reason: string }[];
  } | null>(null);
  const cancelRef = useRef(false);
  
  // Account selection state
  const [existingAibAccounts, setExistingAibAccounts] = useState<Array<{key: string, name: string, type: string}>>([]);
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(null);
  const [isCreatingNewAccount, setIsCreatingNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountType, setNewAccountType] = useState("Current");
  const [finalBalance, setFinalBalance] = useState<number | undefined>();
  const [currency, setCurrency] = useState<string>("EUR");
  const [zeroAmountIndices, setZeroAmountIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    const cached = getParsedTransactions();
    if (cached) {
      setTransactions(cached.transactions);
      // Find transactions with zero amount
      const zeroIndices = new Set<number>();
      cached.transactions.forEach((tx, idx) => {
        if (tx.amount === 0) {
          zeroIndices.add(idx);
        }
      });
      setZeroAmountIndices(zeroIndices);
      
      setParseStats({
        totalRows: cached.totalRows,
        parsedRows: cached.parsedRows,
        skippedRows: cached.skippedRows,
        skippedDetails: cached.skippedDetails,
      });
      setFinalBalance(cached.finalBalance);
      setCurrency(cached.currency || "EUR");
    } else {
      Alert.alert("Error", "No transactions found. Please go back and try again.");
      router.back();
    }
  }, []);

  // Load existing AIB accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!user?.id) return;
      try {
        const balances = await getAccountBalances();
        console.log('All balances:', balances.map(b => ({ name: b.accountName, provider: b.provider, key: b.accountKey })));
        const aibAccounts = balances
          .filter(b => {
            const isAib = b.provider === 'aib' && b.accountKey;
            if (b.accountKey) {
              console.log(`Account ${b.accountName}: provider=${b.provider}, isAib=${isAib}`);
            }
            return isAib;
          })
          .map(b => ({
            key: b.accountKey!,
            name: b.accountName,
            type: b.accountType || 'Current',
          }));
        console.log('Filtered AIB accounts:', aibAccounts);
        setExistingAibAccounts(aibAccounts);
        if (aibAccounts.length === 1) {
          // Auto-select if only one AIB account exists
          setSelectedAccountKey(aibAccounts[0].key);
        } else if (aibAccounts.length === 0) {
          // No existing accounts, default to creating new
          setIsCreatingNewAccount(true);
        }
      } catch (err) {
        console.error('Failed to load AIB accounts:', err);
      }
    };
    loadAccounts();
  }, [user?.id]);

  useEffect(() => {
    const runPrecheck = async () => {
      if (!user?.id || transactions.length === 0) return;
      try {
        const times = transactions.map((t) => new Date(t.date).getTime());
        const startISO = new Date(Math.min(...times)).toISOString();
        const endISO = new Date(Math.max(...times)).toISOString();
        const existing = await getAllTransactionsForUser(user.id);
        const existingKeys = new Set(existing.map(makeKeyFromDoc));
        const dupKeys = new Set<string>();
        let unique = 0;
        let skipped = 0;
        for (const t of transactions) {
          const key = makeKeyFromTransaction(t);
          const isExisting = existingKeys.has(key);
          if (isExisting) {
            skipped++;
            dupKeys.add(key);
            continue;
          }
          unique++;
        }
        setPreSkippedCount(skipped);
        setPreUniqueCount(unique);
        setDuplicateKeys(dupKeys);
        setPrecheckDone(true);
      } catch (e) {
        console.warn("Precheck dedupe failed:", e);
      }
    };
    runPrecheck();
  }, [transactions, user?.id]);

  const handleImport = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (transactions.length === 0) {
      Alert.alert("Error", "No transactions to import");
      return;
    }

    // Validate account selection
    if (!isCreatingNewAccount && !selectedAccountKey) {
      Alert.alert("Error", "Please select an account or create a new one");
      return;
    }

    if (isCreatingNewAccount && !newAccountName.trim()) {
      Alert.alert("Error", "Please enter an account name");
      return;
    }

    cancelRef.current = false;
    setLoading(true);

    try {
      const existing = await getAllTransactionsForUser(user.id);
      const existingKeys = new Set(existing.map(makeKeyFromDoc));

      // Filter out transactions with zero amount and existing transactions
      const deduped: Transaction[] = [];
      for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        // Skip zero-amount transactions
        if (zeroAmountIndices.has(i)) continue;
        const key = makeKeyFromTransaction(t);
        if (existingKeys.has(key)) continue;
        deduped.push(t);
      }

      const existingAsTransactions: Transaction[] = existing.map((doc: any) => ({
        title: doc.title || '',
        subtitle: doc.subtitle || '',
        amount: Math.abs(Number(doc.amount)),
        kind: doc.kind,
        date: doc.date || '',
        categoryId: doc.categoryId || '',
        currency: doc.currency || 'EUR',
        excludeFromAnalytics: doc.excludeFromAnalytics,
        isAnalyticsProtected: doc.isAnalyticsProtected,
      }));
      
      const combinedForDetection = [...existingAsTransactions, ...deduped];
      const transferIndicesInCombined = detectTransferPairs(combinedForDetection);
      
      const existingCount = existingAsTransactions.length;
      const transferIndicesInNew = new Set<number>();
      transferIndicesInCombined.forEach(idx => {
        if (idx >= existingCount) {
          transferIndicesInNew.add(idx - existingCount);
        }
      });
      
      const dedupedWithTransfers = await markTransfers(deduped);
      
      const finalTransactions = dedupedWithTransfers.map((tx, idx) => {
        if (transferIndicesInNew.has(idx) && !tx.isAnalyticsProtected) {
          return {
            ...tx,
            excludeFromAnalytics: true,
            isAnalyticsProtected: true,
          };
        }
        return tx;
      });

      const skipped = transactions.length - finalTransactions.length;
      setSkippedCount(skipped);
      setUniqueCount(finalTransactions.length);
      setImportProgress({ current: 0, total: finalTransactions.length });

      await queueTransactionsForSync(
        user.id, 
        finalTransactions.map(tx => ({ ...tx, source: "aib_import" as const }))
      );

      let current = 0;
      for (const _ of finalTransactions) {
        if (cancelRef.current) break;
        current += 1;
        setImportProgress({ current, total: finalTransactions.length });
        await new Promise(res => setTimeout(res, 50));
      }

      // Update account balance if we have a final balance and account selection
      if (finalBalance !== undefined) {
        const accountName = isCreatingNewAccount ? newAccountName : selectedAccountKey;
        if (accountName) {
          await updateAccountBalance(accountName, finalBalance, currency, {
            provider: "aib",
            accountType: isCreatingNewAccount ? newAccountType : undefined,
          });
          console.log(`Updated balance for ${accountName}: ${(finalBalance / 100).toFixed(2)} ${currency}`);
        }
      }

      await fetchHome();
      clearParsedTransactions();
      Alert.alert("Success", `Imported ${finalTransactions.length} transactions`, [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    } catch (err) {
      console.error("Import error:", err);
      Alert.alert("Error", "Failed to import transactions");
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: Transaction; index: number }) => {
    const isExpense = item.kind === "expense";
    const isZeroAmount = zeroAmountIndices.has(index);
    
    return (
      <View className={`rounded-2xl border p-4 mb-3 ${isZeroAmount ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`}>
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-1 flex-row items-center gap-2">
            <Text className={`text-base font-semibold flex-1 ${isZeroAmount ? 'text-gray-400' : 'text-dark-100'}`} numberOfLines={1}>{item.title || "Transaction"}</Text>
            {isZeroAmount && (
              <View className="bg-yellow-100 px-2 py-1 rounded">
                <Text className="text-xs font-semibold text-yellow-800">Skipped</Text>
              </View>
            )}
          </View>
          <Text className={`text-base font-bold ${isZeroAmount ? 'text-gray-400' : isExpense ? "text-red-500" : "text-green-600"}`}>
            {isExpense ? "-" : "+"}{(item.amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency}
          </Text>
        </View>
        <Text className={`text-sm ${isZeroAmount ? 'text-gray-400' : 'text-gray-500'}`} numberOfLines={1}>{item.subtitle || item.categoryId}</Text>
        <View className="flex-row justify-between items-center mt-2">
          <Text className={`text-xs ${isZeroAmount ? 'text-gray-400' : 'text-gray-500'}`}>{new Date(item.date).toLocaleDateString()}</Text>
          <Text className={`text-xs ${isZeroAmount ? 'text-gray-400' : 'text-gray-500'}`}>{item.categoryId}</Text>
        </View>
        {isZeroAmount && (
          <Text className="text-xs text-yellow-700 mt-2">Zero amount transactions will not be imported</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        <View className="px-5 pt-5 pb-4 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="mb-4 flex-row items-center gap-2">
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-dark-100">AIB Import Preview</Text>
          <Text className="text-sm text-gray-500 mt-1">Review and confirm your imported transactions</Text>
          {parseStats && (
            <Text className="text-xs text-gray-400 mt-2">
              Parsed {parseStats.parsedRows}/{parseStats.totalRows} rows • Skipped {parseStats.skippedRows}
            </Text>
          )}
        </View>

        {/* Progress */}
        {loading && (
          <View className="px-5 py-3 bg-yellow-50 border-b border-yellow-100 flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#ca8a04" />
            <Text className="text-sm text-yellow-800">
              Importing {importProgress.current}/{importProgress.total}...
            </Text>
          </View>
        )}

        {/* Precheck info */}
        {precheckDone && (
          <View className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <Text className="text-xs text-gray-600">
              {preUniqueCount} new, {preSkippedCount} already in your account.
            </Text>
          </View>
        )}

        {/* Account Selection */}
        <View className="px-5 py-4 bg-blue-50 border-b border-blue-100">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Select AIB Account</Text>
          
          {existingAibAccounts.length > 0 && (
            <View className="mb-3">
              {existingAibAccounts.map((acc) => (
                <Pressable
                  key={acc.key}
                  onPress={() => {
                    setSelectedAccountKey(acc.key);
                    setIsCreatingNewAccount(false);
                  }}
                  className={`p-3 rounded-xl mb-2 border-2 ${
                    selectedAccountKey === acc.key && !isCreatingNewAccount
                      ? "bg-sky-50 border-sky-500"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text className="text-sm font-semibold text-gray-800">{acc.name}</Text>
                  <Text className="text-xs text-gray-500">{acc.type}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => {
              setIsCreatingNewAccount(true);
              setSelectedAccountKey(null);
            }}
            className={`p-3 rounded-xl border-2 ${
              isCreatingNewAccount
                ? "bg-sky-50 border-sky-500"
                : "bg-white border-gray-200"
            }`}
          >
            <Text className="text-sm font-semibold text-gray-800">+ Create New Account</Text>
          </Pressable>

          {isCreatingNewAccount && (
            <View className="mt-3 gap-3">
              <View>
                <Text className="text-xs text-gray-600 mb-1">Account Name</Text>
                <TextInput
                  value={newAccountName}
                  onChangeText={setNewAccountName}
                  placeholder="e.g., AIB Current Account"
                  className="bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm"
                />
              </View>
              <View>
                <Text className="text-xs text-gray-600 mb-1">Account Type</Text>
                <View className="flex-row gap-2">
                  {["Current", "Savings", "Credit Card"].map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setNewAccountType(type)}
                      className={`px-4 py-2 rounded-xl border ${
                        newAccountType === type
                          ? "bg-sky-500 border-sky-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          newAccountType === type ? "text-white" : "text-gray-700"
                        }`}
                      >
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        <FlatList
          data={transactions}
          keyExtractor={(_, idx) => `tx-${idx}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
          ListEmptyComponent={() => (
            <View className="items-center justify-center py-20">
              <Text className="text-gray-400">No transactions to preview</Text>
            </View>
          )}
        />
      </View>

      {/* Footer */}
      <View className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-4 bg-white border-t border-gray-200">
        <View className="gap-3">
          <Pressable
            onPress={handleImport}
            disabled={loading || transactions.length === 0}
            className={`rounded-2xl py-4 items-center ${
              loading || transactions.length === 0 ? "bg-gray-300" : "bg-sky-500"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">Import to Budget</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => {
              clearParsedTransactions();
              router.back();
            }}
            disabled={loading}
            className="rounded-2xl border-2 border-gray-200 py-4 items-center bg-white"
          >
            <Text className="text-gray-700 text-base font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
