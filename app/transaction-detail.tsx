import { router } from "expo-router";
import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, TextInput, Switch, Modal, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useHomeStore } from "@/store/useHomeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useTransactionDetailStore } from "@/store/useTransactionDetailStore";
import { formatCurrency } from "@/lib/currencyFunctions";
import { databases } from "@/lib/appwrite";
import { getQueuedTransactions } from "@/lib/syncQueue";
import { learnMerchantCategory } from "@/lib/categorization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Transaction } from "@/types/type";

export default function TransactionDetailScreen() {
  const { selectedTransactionId } = useTransactionDetailStore();
  const id = selectedTransactionId?.trim();
  const { categories, summary } = useHomeStore();
  const { user } = useSessionStore();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedAmount, setEditedAmount] = useState("");
  const [editedExcludeFromAnalytics, setEditedExcludeFromAnalytics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isQueuedTransaction, setIsQueuedTransaction] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const currency = summary?.currency ?? "USD";

  // Fetch transaction details
  useEffect(() => {
    console.log("selectedTransactionId:", selectedTransactionId, "trimmed id:", id);
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    if (!id || id.length === 0 || !user?.id) {
      console.log("Skipping load - missing id or user:", { id, userId: user?.id });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log("Loading transaction with ID:", id);
      
      // First check if this transaction exists in the queue
      const queuedTxs = await getQueuedTransactions(user.id);
      const queuedTx = queuedTxs.find(t => t.id === id);
      
      if (queuedTx) {
        // This is a queued transaction (not yet synced or currently syncing)
        console.log("Loading from queue - transaction not yet synced");
        setTransaction(queuedTx);
        setEditedTitle(queuedTx.title);
        setEditedAmount((queuedTx.amount / 100).toString());
        setEditedExcludeFromAnalytics(queuedTx.excludeFromAnalytics ?? false);
        setIsQueuedTransaction(true);
        console.log("Loaded queued transaction:", queuedTx);
      } else {
        // Load from database (either never queued or already synced)
        const response = await databases.getDocument(
          "budget_app_db",
          "transactions",
          id
        );

        const tx: Transaction = {
          id: response.$id,
          title: response.title,
          subtitle: response.subtitle,
          amount: response.amount,
          categoryId: response.categoryId,
          kind: response.kind,
          date: response.date,
          excludeFromAnalytics: response.excludeFromAnalytics ?? false,
        };

        setTransaction(tx);
        setEditedTitle(tx.title);
        setEditedAmount((tx.amount / 100).toString());
        setEditedExcludeFromAnalytics(tx.excludeFromAnalytics ?? false);
        setIsQueuedTransaction(false);
        console.log("Loaded database transaction:", tx);
      }
    } catch (error) {
      console.error("Failed to load transaction:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!transaction || !user?.id) return;

    try {
      setSaving(true);
      const amount = Math.round(parseFloat(editedAmount) * 100);

      if (isQueuedTransaction) {
        // Update queued transaction in AsyncStorage
        const queuedTxs = await getQueuedTransactions();
        const updated = queuedTxs.map(t =>
          t.id === id
            ? { ...t, title: editedTitle, amount, excludeFromAnalytics: editedExcludeFromAnalytics }
            : t
        );
        await AsyncStorage.setItem("budget_app_sync_queue", JSON.stringify(updated));
      } else {
        // Update database transaction
        await databases.updateDocument(
          "budget_app_db",
          "transactions",
          id!,
          {
            title: editedTitle,
            amount,
            excludeFromAnalytics: editedExcludeFromAnalytics,
          }
        );
      }

      setTransaction({
        ...transaction,
        title: editedTitle,
        amount,
        excludeFromAnalytics: editedExcludeFromAnalytics,
      });

      // Refresh home store to reflect analytics changes
      const { fetchHome } = useHomeStore.getState();
      fetchHome();

      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save transaction:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!transaction || !user?.id) return;

    try {
      setSaving(true);
      if (isQueuedTransaction) {
        // Delete queued transaction from AsyncStorage
        const queuedTxs = await getQueuedTransactions();
        const updated = queuedTxs.filter(t => t.id !== id);
        await AsyncStorage.setItem("budget_app_sync_queue", JSON.stringify(updated));
      } else {
        // Delete database transaction
        await databases.deleteDocument(
          "budget_app_db",
          "transactions",
          id!
        );
      }
      router.back();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      setSaving(false);
    }
  };

  const handleSelectCategory = async (newCategoryId: string) => {
    if (!transaction || !user?.id) return;

    try {
      if (isQueuedTransaction) {
        // Update queued transaction in AsyncStorage
        const queuedTxs = await getQueuedTransactions();
        const updated = queuedTxs.map(t =>
          t.id === id
            ? { ...t, categoryId: newCategoryId }
            : t
        );
        await AsyncStorage.setItem("budget_app_sync_queue", JSON.stringify(updated));
      } else {
        // Update database transaction
        await databases.updateDocument(
          "budget_app_db",
          "transactions",
          id!,
          { categoryId: newCategoryId }
        );
      }

      // Learn this merchant-category mapping for future imports
      await learnMerchantCategory(transaction.title, newCategoryId);

      // Update the transaction state
      setTransaction({
        ...transaction,
        categoryId: newCategoryId,
      });

      // Refresh home store to reflect analytics changes
      const { fetchHome } = useHomeStore.getState();
      fetchHome();

      setShowCategoryDropdown(false);
      console.log("Updated category to:", newCategoryId);
    } catch (error) {
      console.error("Failed to update category:", error);
    }
  };

  const handleToggleExcludeFromAnalytics = async (newValue: boolean) => {
    if (!transaction || !user?.id) return;

    try {
      setEditedExcludeFromAnalytics(newValue);

      if (isQueuedTransaction) {
        // Update queued transaction in AsyncStorage
        const queuedTxs = await getQueuedTransactions();
        const updated = queuedTxs.map(t =>
          t.id === id
            ? { ...t, excludeFromAnalytics: newValue }
            : t
        );
        await AsyncStorage.setItem("budget_app_sync_queue", JSON.stringify(updated));
      } else {
        // Update database transaction
        await databases.updateDocument(
          "budget_app_db",
          "transactions",
          id!,
          { excludeFromAnalytics: newValue }
        );
      }

      // Update the transaction state
      setTransaction({
        ...transaction,
        excludeFromAnalytics: newValue,
      });

      // Refresh home store to reflect analytics changes
      const { fetchHome } = useHomeStore.getState();
      fetchHome();

      console.log("Updated excludeFromAnalytics to:", newValue);
    } catch (error) {
      console.error("Failed to toggle excludeFromAnalytics:", error);
      // Revert the change on error
      setEditedExcludeFromAnalytics(!newValue);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#7C3AED" />
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-5 pt-2 pb-6">
          <Pressable
            onPress={() => router.back()}
            className="flex-row items-center gap-2"
          >
            <Feather name="chevron-left" size={20} color="#7C3AED" />
            <Text className="text-primary text-base font-semibold">Back</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-gray-400 text-center">Transaction not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const category = categories.find(c => c.id === transaction.categoryId);

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-5 pt-2 pb-6 border-b border-gray-200 flex-row items-center justify-between">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center gap-2"
        >
          <Feather name="chevron-left" size={20} color="#7C3AED" />
          <Text className="text-primary text-base font-semibold">Back</Text>
        </Pressable>
        {!isEditing && (
          <Pressable
            onPress={() => setIsEditing(true)}
            className="p-2 active:opacity-70"
          >
            <Feather name="edit-2" size={18} color="#7C3AED" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5 py-6" showsVerticalScrollIndicator={false}>
        {/* Amount Display / Input */}
        <View className="mb-6">
          <Text className="text-gray-500 text-sm mb-2">Amount</Text>
          {isEditing ? (
            <TextInput
              value={editedAmount}
              onChangeText={setEditedAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              className="text-4xl font-bold text-dark-100 border-b-2 border-primary pb-2"
            />
          ) : (
            <Text className="text-4xl font-bold text-dark-100">
              {formatCurrency(transaction.amount / 100, currency)}
            </Text>
          )}
        </View>

        {/* Title */}
        <View className="mb-6">
          <Text className="text-gray-500 text-sm mb-2">Title</Text>
          {isEditing ? (
            <TextInput
              value={editedTitle}
              onChangeText={setEditedTitle}
              placeholder="Transaction title"
              className="text-base text-dark-100 border-b-2 border-primary pb-2 mb-2"
            />
          ) : (
            <Text className="text-base font-semibold text-dark-100">{transaction.title}</Text>
          )}
        </View>

        {/* Category */}
        <Pressable
          onPress={() => setShowCategoryDropdown(true)}
          className="mb-6 active:opacity-70"
        >
          <View className="p-4 rounded-2xl bg-gray-50">
            <Text className="text-gray-500 text-sm mb-2">Category</Text>
            <View className="flex-row items-center gap-3 justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: category?.color || "#7C3AED" }}
                >
                  <Feather name="shopping-bag" size={16} color="white" />
                </View>
                <Text className="text-base font-semibold text-dark-100">
                  {category?.name || "Unknown"}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#9CA3AF" />
            </View>
          </View>
        </Pressable>

        {/* Type */}
        <View className="mb-6 p-4 rounded-2xl bg-gray-50">
          <Text className="text-gray-500 text-sm mb-2">Type</Text>
          <Text className="text-base font-semibold text-dark-100 capitalize">
            {transaction.kind}
          </Text>
        </View>

        {/* Date */}
        <View className="mb-6 p-4 rounded-2xl bg-gray-50">
          <Text className="text-gray-500 text-sm mb-2">Date</Text>
          <Text className="text-base font-semibold text-dark-100">
            {new Date(transaction.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Exclude from Analytics Toggle */}
        <View className="mb-6 p-4 rounded-2xl bg-gray-50 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-dark-100">
              Exclude from Analytics
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {editedExcludeFromAnalytics
                ? "This transaction won't appear in reports"
                : "This transaction will appear in reports"}
            </Text>
          </View>
          <Switch
            value={editedExcludeFromAnalytics}
            onValueChange={handleToggleExcludeFromAnalytics}
            trackColor={{ false: "#E5E7EB", true: "#7C3AED" }}
            thumbColor={editedExcludeFromAnalytics ? "#FFFFFF" : "#F3F4F6"}
          />
        </View>

        {/* Transaction ID */}
        <View className="mb-6 p-4 rounded-2xl bg-gray-50">
          <Text className="text-gray-500 text-xs mb-2">Transaction ID</Text>
          <Text className="text-xs text-gray-600 font-mono">{transaction.id}</Text>
        </View>

        {/* Action Buttons */}
        {isEditing && (
          <View className="gap-3 mb-6">
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="bg-primary rounded-2xl py-4 items-center active:opacity-70 disabled:opacity-50"
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-semibold">Save Changes</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setIsEditing(false);
                setEditedTitle(transaction.title);
                setEditedAmount((transaction.amount / 100).toString());
                setEditedExcludeFromAnalytics(transaction.excludeFromAnalytics || false);
              }}
              className="border border-gray-300 rounded-2xl py-4 items-center active:opacity-70"
            >
              <Text className="text-dark-100 font-semibold">Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Delete Button */}
        <Pressable
          onPress={handleDelete}
          disabled={saving}
          className="bg-red-500 rounded-2xl py-4 items-center active:opacity-70 disabled:opacity-50"
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold">Delete Transaction</Text>
          )}
        </Pressable>
      </ScrollView>

      {/* Category Dropdown Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-2/3">
            {/* Header */}
            <View className="px-5 pt-4 pb-2 border-b border-gray-200 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-dark-100">Select Category</Text>
              <Pressable
                onPress={() => setShowCategoryDropdown(false)}
                className="p-2 active:opacity-70"
              >
                <Feather name="x" size={24} color="#181C2E" />
              </Pressable>
            </View>

            {/* Categories List */}
            <FlatList
              data={categories.filter(cat => cat.id !== "all")}
              keyExtractor={cat => cat.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelectCategory(item.id)}
                  className={`px-5 py-4 border-b border-gray-100 flex-row items-center gap-3 active:bg-gray-50 ${
                    transaction?.categoryId === item.id ? "bg-primary/10" : ""
                  }`}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: item.color || "#7C3AED" }}
                  >
                    <Feather name="shopping-bag" size={16} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-dark-100">{item.name}</Text>
                  </View>
                  {transaction?.categoryId === item.id && (
                    <Feather name="check" size={20} color="#7C3AED" />
                  )}
                </Pressable>
              )}
              scrollEnabled
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
