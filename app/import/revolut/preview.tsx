import { createBulkTransactions, getAllTransactionsForUser } from "@/lib/appwrite";
import { useHomeStore } from "@/store/useHomeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
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
}

// Helpers for robust deduping (normalize text, amount, and date to a stable key)
const normalizeText = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
const normalizeDateToISO = (value: string) => {
  if (!value) return "";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return (value || "").trim();
  return new Date(t).toISOString(); // normalize timezone/format
};
// Use absolute amount to be resilient to legacy records that stored negative expenses
const makeKeyFromTransaction = (t: Transaction) =>
  `${normalizeText(t.title)}|${Math.abs(t.amount)}|${t.kind}|${normalizeDateToISO(t.date)}`;
const makeKeyFromDoc = (doc: any) =>
  `${normalizeText(doc.title || "")}|${Math.abs(Number(doc.amount))}|${doc.kind}|${normalizeDateToISO(doc.date || "")}`;

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

  // Get transactions from cache
  useEffect(() => {
    const cached = getParsedTransactions();
    if (cached) {
      setTransactions(cached.transactions);
      setParseStats({
        totalRows: cached.totalRows,
        parsedRows: cached.parsedRows,
        skippedRows: cached.skippedRows,
        skippedDetails: cached.skippedDetails,
      });
    } else {
      Alert.alert("Error", "No transactions found. Please go back and try again.");
      router.back();
    }
  }, []);

  // Precheck dedupe so the user sees skips before importing
  useEffect(() => {
    const runPrecheck = async () => {
      if (!user?.id || transactions.length === 0) return;
      try {
        const times = transactions.map((t) => new Date(t.date).getTime());
        const startISO = new Date(Math.min(...times)).toISOString();
        const endISO = new Date(Math.max(...times)).toISOString();
        // Fetch all existing transactions for this user (paginated) to catch any duplicates
        const existing = await getAllTransactionsForUser(user.id);
        const existingKeys = new Set(existing.map(makeKeyFromDoc));
        const newKeys = new Set<string>();
        const dupKeys = new Set<string>();
        let unique = 0;
        let skipped = 0;
        for (const t of transactions) {
          const key = makeKeyFromTransaction(t);
          const isExisting = existingKeys.has(key);
          const isRepeatInUpload = newKeys.has(key);
          if (isExisting || isRepeatInUpload) {
            skipped++;
            dupKeys.add(key);
            continue;
          }
          newKeys.add(key);
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

    cancelRef.current = false;
    setLoading(true);

    try {
      console.log(`Starting import of ${transactions.length} transactions`);

      // Compute import date range
      const times = transactions.map((t) => new Date(t.date).getTime());
      const startISO = new Date(Math.min(...times)).toISOString();
      const endISO = new Date(Math.max(...times)).toISOString();

      // Fetch existing transactions in range to dedupe
      // Fetch all existing transactions for this user (paginated) to avoid missing duplicates
      const existing = await getAllTransactionsForUser(user.id);
      const existingKeys = new Set(existing.map(makeKeyFromDoc));

      // Dedupe within new list and against existing
      const newKeys = new Set<string>();
      const deduped: Transaction[] = [];
      for (const t of transactions) {
        const key = makeKeyFromTransaction(t);
        if (existingKeys.has(key)) continue;
        if (newKeys.has(key)) continue;
        newKeys.add(key);
        deduped.push(t);
      }

      const skipped = transactions.length - deduped.length;
      setSkippedCount(skipped);
      setUniqueCount(deduped.length);
      setImportProgress({ current: 0, total: deduped.length });

      // Create transactions with progress callback
      const result = await createBulkTransactions(
        user.id,
        deduped,
        (current, total) => {
          console.log(`Import progress: ${current}/${total}`);
          setImportProgress({ current, total });
        },
        () => cancelRef.current
      );

      const failedCount = result.failed;
      const createdCount = result.created;

      console.log(`Import complete: ${createdCount} created, ${failedCount} failed`);

      const errorDetails = failedCount
        ? `\nFailed to create ${failedCount} transaction${failedCount === 1 ? "" : "s"}.`
        : "";

      Alert.alert(
        "Success",
        `Imported ${createdCount} transactions.${skipped > 0 ? `\nSkipped ${skipped} duplicate(s).` : ""}${errorDetails}`,
        [
          {
            text: "View Home",
            onPress: async () => {
              clearParsedTransactions();
              await fetchHome();
              router.replace("/");
            },
          },
        ]
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to import transactions";
      Alert.alert("Import Error", errorMsg);
      console.error("Import error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) {
      cancelRef.current = true;
    } else {
      router.back();
    }
  };

  const getTransactionColor = (kind: "income" | "expense") => {
    return kind === "income" ? "#10B981" : "#EF4444";
  };

  const formatAmount = (amount: number, kind: "income" | "expense") => {
    const sign = kind === "income" ? "+" : "-";
    const value = (amount / 100).toFixed(2);
    return `${sign}$${value}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 flex-col">
        {/* Header */}
        <View className="px-5 pt-4 pb-4 border-b border-gray-200">
          <Pressable
            onPress={() => router.back()}
            className="mb-4 flex-row items-center gap-2"
          >
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <View>
            <Text className="text-2xl font-bold text-dark-100">Review Transactions</Text>
            <Text className="text-sm text-gray-600 mt-1">
              {transactions.length} transactions ready to import
            </Text>
          </View>
        </View>

        {/* Summary */}
        <View className="px-5 pt-4 pb-4 border-b border-gray-100 gap-3">
          <View className="flex-row gap-4">
            <View className="flex-1 rounded-lg bg-green-50 p-3">
              <Text className="text-xs text-green-700 font-semibold">Income</Text>
              <Text className="text-lg font-bold text-green-700 mt-1">
                ${(
                  transactions
                    .filter((t) => t.kind === "income")
                    .reduce((sum, t) => sum + t.amount, 0) / 100
                ).toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 rounded-lg bg-red-50 p-3">
              <Text className="text-xs text-red-700 font-semibold">Expenses</Text>
              <Text className="text-lg font-bold text-red-700 mt-1">
                $
                {Math.abs(
                  transactions
                    .filter((t) => t.kind === "expense")
                    .reduce((sum, t) => sum + t.amount, 0) / 100
                ).toFixed(2)}
              </Text>
            </View>
          </View>

          {precheckDone && (
            <View className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <Text className="text-xs text-blue-900 font-semibold">
                Parsed {parseStats.parsedRows} of {parseStats.totalRows} data rows
              </Text>
              {parseStats.skippedRows > 0 && (
                <View className="mt-1 gap-1">
                  <Text className="text-[11px] text-blue-800">
                    Skipped {parseStats.skippedRows} empty/invalid row{parseStats.skippedRows === 1 ? "" : "s"}.
                  </Text>
                  {parseStats.skippedDetails.slice(0, 3).map((d, idx) => (
                    <Text key={`${d.line}-${idx}`} className="text-[11px] text-blue-700">
                      Line {d.line}: {d.reason}
                    </Text>
                  ))}
                  {parseStats.skippedDetails.length > 3 && (
                    <Text className="text-[11px] text-blue-700">
                      +{parseStats.skippedDetails.length - 3} more
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Transaction List */}
        <FlatList
          data={transactions}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => {
            const key = makeKeyFromTransaction(item);
            const isDuplicate = duplicateKeys.has(key);
            return (
              <View className="px-5 py-3 border-b border-gray-100 flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold text-dark-100">{item.title}</Text>
                    {isDuplicate && (
                      <View className="px-2 py-1 rounded-full bg-red-100">
                        <Text className="text-[11px] font-semibold text-red-700">Will skip</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-1">{item.subtitle}</Text>
                  <Text className="text-xs text-gray-400 mt-1">{formatDate(item.date)}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text
                    className="font-bold text-sm"
                    style={{ color: getTransactionColor(item.kind) }}
                  >
                    {formatAmount(item.amount, item.kind)}
                  </Text>
                </View>
              </View>
            );
          }}
          scrollEnabled={true}
          contentContainerStyle={{ paddingBottom: 20 }}
        />

        {/* Action Buttons */}
        <View className="px-5 py-4 gap-3 border-t border-gray-200">
          {precheckDone && !loading && (
            <View className="items-center">
              <Text className="text-xs text-gray-600">
                Will skip {preSkippedCount} duplicate{preSkippedCount === 1 ? "" : "s"} • Will import {preUniqueCount}
              </Text>
            </View>
          )}
          {loading && (
            <View className="items-center">
              <Text className="text-xs text-gray-600">
                Skipping {skippedCount} duplicate{skippedCount === 1 ? "" : "s"} • Importing {uniqueCount}
              </Text>
            </View>
          )}
          <Pressable
            onPress={handleImport}
            disabled={loading || transactions.length === 0}
            className={`rounded-2xl py-4 items-center ${
              loading || transactions.length === 0 ? "bg-gray-300" : "bg-primary"
            }`}
          >
            {loading ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#fff" />
                <Text className="text-white text-base font-bold">
                  Importing {importProgress.current}/{importProgress.total}...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Feather name="check-circle" size={18} color="white" />
                <Text className="text-white text-base font-bold">
                  Import {precheckDone ? preUniqueCount : transactions.length}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={handleCancel}
            className="rounded-2xl border-2 border-gray-200 py-4 items-center bg-white"
          >
            <Text className="text-gray-700 text-base font-semibold">
              {loading ? "Cancel import" : "Cancel"}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
