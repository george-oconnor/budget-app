import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { Summary } from "@/types/type";
import { formatCurrency } from "@/lib/currencyFunctions";

export default function IncomeExpenseRow({
  summary,
  loading,
}: {
  summary: Summary | null;
  loading: boolean;
}) {
  const currency = summary?.currency ?? "USD";
  return (
    <View className="flex-row gap-4 mt-4">
      <View className="flex-1 rounded-3xl bg-white px-5 py-5 shadow-sm border border-gray-100">
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="arrow-top-right" size={18} color="#2F9B65" />
          <Text className="text-dark-100 text-base font-bold">Income</Text>
        </View>
        <Text className="text-dark-100 text-2xl font-bold mt-2">
          {loading ? "…" : formatCurrency((summary?.income ?? 0) / 100, currency)}
        </Text>
      </View>
      <View className="flex-1 rounded-3xl bg-white px-5 py-5 shadow-sm border border-gray-100">
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="arrow-bottom-right" size={18} color="#F14141" />
          <Text className="text-dark-100 text-base font-bold">Expenses</Text>
        </View>
        <Text className="text-dark-100 text-2xl font-bold mt-2">
          {loading ? "…" : formatCurrency((summary?.expenses ?? 0) / 100, currency)}
        </Text>
      </View>
    </View>
  );
}
