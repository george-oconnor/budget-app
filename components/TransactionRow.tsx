import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { Transaction } from "@/types/type";
import { formatCurrency } from "@/lib/currencyFunctions";

export default function TransactionRow({
  transaction,
  currency,
  categoryName,
}: {
  transaction: Transaction;
  currency: string;
  categoryName?: string;
}) {
  const isIncome = transaction.kind === "income";
  const amountColor = isIncome ? "text-green-600" : "text-red-500";
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm border border-gray-100">
      <View className="flex-row items-center gap-3 flex-1">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <MaterialCommunityIcons
            name={isIncome ? "tray-arrow-down" : "tray-arrow-up"}
            size={20}
            color={isIncome ? "#2F9B65" : "#F14141"}
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-dark-100" numberOfLines={1}>{transaction.title}</Text>
          <Text className="text-xs text-gray-700">{categoryName || "No category"}</Text>
        </View>
      </View>
      <View className="items-end ml-2">
        <Text className={`text-base font-semibold ${amountColor}`}>
          {formatCurrency(transaction.amount / 100, currency)}
        </Text>
        <Text className="text-xs text-gray-500">
          {new Date(transaction.date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );
}
