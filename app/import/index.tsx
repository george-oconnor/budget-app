import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const IMPORT_OPTIONS = [
  {
    id: "revolut",
    name: "Revolut",
    icon: "credit-card",
    description: "Import transactions from your Revolut account",
    color: "#4F46E5",
  },
  {
    id: "csv",
    name: "CSV File",
    icon: "file-text",
    description: "Import from a CSV file",
    color: "#10B981",
    comingSoon: true,
  },
  {
    id: "manual",
    name: "Manual Entry",
    icon: "plus-circle",
    description: "Add transactions manually",
    color: "#F59E0B",
    comingSoon: true,
  },
];

export default function ImportScreen() {
  const handleImportOption = (optionId: string) => {
    switch (optionId) {
      case "revolut":
        router.push("/import/revolut");
        break;
      case "csv":
        console.log("CSV import coming soon");
        break;
      case "manual":
        console.log("Manual entry coming soon");
        break;
      default:
        break;
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
          <Text className="text-3xl font-bold text-dark-100">Import Transactions</Text>
          <Text className="text-sm text-gray-500 mt-2">
            Add transactions from your bank or financial accounts
          </Text>
        </View>

        {/* Import Options */}
        <View className="gap-3 mb-8">
          {IMPORT_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => !option.comingSoon && handleImportOption(option.id)}
              disabled={option.comingSoon}
              className={`rounded-2xl border-2 p-4 flex-row items-start gap-4 ${
                option.comingSoon
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : "border-gray-200 bg-white active:bg-gray-50"
              }`}
            >
              <View
                className="h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: option.comingSoon ? "#E5E7EB" : `${option.color}20` }}
              >
                <Feather
                  name={option.icon as any}
                  size={24}
                  color={option.comingSoon ? "#999" : option.color}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-semibold text-dark-100">{option.name}</Text>
                  {option.comingSoon && (
                    <View className="bg-gray-300 rounded px-2 py-1">
                      <Text className="text-xs font-semibold text-gray-600">Coming soon</Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm text-gray-600 mt-1">{option.description}</Text>
              </View>
              {!option.comingSoon && (
                <Feather name="chevron-right" size={20} color="#667eea" />
              )}
            </Pressable>
          ))}
        </View>

        {/* Info Box */}
        <View className="rounded-xl bg-blue-50 border border-blue-200 p-4 mb-8">
          <Text className="text-xs font-semibold text-blue-900 mb-2">💡 About Imports</Text>
          <Text className="text-xs text-blue-800 leading-5">
            Importing transactions helps you track spending from multiple accounts. All imported
            transactions are securely stored and categorized automatically based on merchant and
            transaction type.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
