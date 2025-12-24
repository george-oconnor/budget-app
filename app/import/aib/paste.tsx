import {
    AibParseResult,
    convertAibToAppTransaction,
    markTransfers,
    parseAibCSV,
    ParsedTransaction,
    SkippedRow,
} from "@/lib/csvParser";
import { useSessionStore } from "@/store/useSessionStore";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Temporary storage for parsed transactions (in-memory)
type ParsedCache = {
  transactions: ParsedTransaction[];
  parsedRows: number;
  totalRows: number;
  skippedRows: number;
  skippedDetails: SkippedRow[];
};

let parsedTransactionsCache: ParsedCache | null = null;

export function getParsedTransactions(): ParsedCache | null {
  return parsedTransactionsCache;
}

export function clearParsedTransactions() {
  parsedTransactionsCache = null;
}

export default function AibImportPasteScreen() {
  const [csvContent, setCSVContent] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useSessionStore();

  const handlePaste = async () => {
    try {
      const content = await Clipboard.getStringAsync();
      if (!content) {
        Alert.alert("Error", "No text found in clipboard");
        return;
      }
      setCSVContent(content);
      Alert.alert("Success", `Pasted ${content.split("\n").length} lines from clipboard`);
    } catch (err) {
      Alert.alert("Error", "Failed to paste from clipboard");
      console.error("Paste error:", err);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled) {
        console.log("File picker was canceled");
        return;
      }
      
      if (!result.assets || result.assets.length === 0) {
        console.log("No file selected");
        return;
      }
      
      const asset = result.assets[0];
      if (!asset.uri) {
        Alert.alert("Error", "No file URI found");
        return;
      }
      
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      setCSVContent(content);
      Alert.alert("Success", `Loaded ${content.split("\n").length} lines from ${asset.name || "file"}`);
    } catch (err) {
      Alert.alert("Error", "Failed to read CSV file");
      console.error("File pick error:", err);
    }
  };

  const handleContinue = async () => {
    if (!csvContent.trim()) {
      Alert.alert("Error", "Please paste the CSV data from AIB");
      return;
    }

    setLoading(true);
    try {
      const transactions = parseAibCSV(csvContent);
      const parseResult: AibParseResult = transactions;
      console.log(`Parsed ${parseResult.transactions.length} transactions from AIB CSV`);

      if (parseResult.transactions.length === 0) {
        Alert.alert("Error", "No transactions found in the CSV data");
        setLoading(false);
        return;
      }

      const convertedTransactions = await Promise.all(
        parseResult.transactions.map(convertAibToAppTransaction)
      );

      const transactionsWithTransfers = await markTransfers(convertedTransactions);

      parsedTransactionsCache = {
        transactions: transactionsWithTransfers,
        parsedRows: parseResult.transactions.length,
        totalRows: parseResult.totalRows,
        skippedRows: parseResult.skipped,
        skippedDetails: parseResult.skippedDetails,
      };

      router.push("/import/aib/preview" as any);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to parse CSV";
      Alert.alert("Parse Error", errorMsg);
      console.error("CSV parse error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="mb-8">
          <Pressable
            onPress={() => router.back()}
            className="mb-6 flex-row items-center gap-2"
          >
            <Text className="text-primary text-base">← Back</Text>
          </Pressable>
          <Text className="text-3xl font-bold text-dark-100">Paste AIB CSV</Text>
          <Text className="text-sm text-gray-500 mt-2">
            Copy the CSV from AIB online banking and paste it below
          </Text>
        </View>

        {/* Instructions */}
        <View className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-6">
          <Text className="text-xs font-semibold text-blue-900 mb-2">📝 How to Export</Text>
          <Text className="text-xs text-blue-800 leading-5 mb-2">
            In AIB: Accounts → Select Account → Statements/Download → Choose Date Range → CSV
          </Text>
          <Text className="text-xs text-blue-700 font-semibold">
            Then tap the "Paste CSV" button below
          </Text>
        </View>

        {/* Paste Button */}
        <Pressable
          onPress={handlePaste}
          disabled={loading}
          className="rounded-xl bg-white border-2 border-sky-500 p-6 mb-6 active:opacity-80"
        >
          <View className="items-center gap-3">
            <View className="w-16 h-16 rounded-full bg-sky-100 items-center justify-center">
              <Feather name="clipboard" size={28} color="#0EA5E9" />
            </View>
            <Text className="text-base font-bold text-sky-600">Paste CSV from Clipboard</Text>
            <Text className="text-xs text-gray-500 text-center">
              Copy CSV from AIB, then tap here to paste
            </Text>
          </View>
        </Pressable>

        {/* File Upload Button */}
        <Pressable
          onPress={handlePickFile}
          disabled={loading}
          className="rounded-xl bg-white border-2 border-gray-200 p-6 mb-6 active:opacity-80"
        >
          <View className="items-center gap-3">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center">
              <Feather name="upload" size={28} color="#4B5563" />
            </View>
            <Text className="text-base font-bold text-gray-800">Upload CSV file</Text>
            <Text className="text-xs text-gray-500 text-center">
              Pick an AIB CSV from Files if you prefer not to paste
            </Text>
          </View>
        </Pressable>

        {/* Status Info */}
        {csvContent.trim() && (
          <View className="rounded-lg bg-green-50 border border-green-200 p-4 mb-6">
            <View className="flex-row items-center gap-2 mb-1">
              <Feather name="check-circle" size={16} color="#10B981" />
              <Text className="text-sm font-semibold text-green-900">CSV Data Ready</Text>
            </View>
            <Text className="text-xs text-green-700">
              {csvContent.split("\n").length} lines • Ready to import approximately {Math.max(0, csvContent.split("\n").length - 1)} transactions
            </Text>
          </View>
        )}

        {/* Preview Info */}
        {csvContent.trim() && (
          <View className="rounded-lg bg-gray-50 p-3 mb-6">
            <Text className="text-xs text-gray-600">
              {`Detected ~${Math.max(0, csvContent.split("\n").length - 1)} transaction lines (excluding header)`}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3">
          <Pressable
            onPress={handleContinue}
            disabled={loading || !csvContent.trim()}
            className={`rounded-2xl py-4 items-center ${
              loading || !csvContent.trim() ? "bg-gray-300" : "bg-sky-500"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-bold">Review Transactions</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            disabled={loading}
            className="rounded-2xl border-2 border-gray-200 py-4 items-center bg-white"
          >
            <Text className="text-gray-700 text-base font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
