import { Client, Databases, Query } from "appwrite";

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
// Appwrite now refers to 'Tables' in UI; SDK still uses collection IDs.
// Support both env names to avoid confusion.
const transactionsTableId =
  process.env.EXPO_PUBLIC_APPWRITE_TABLE_TRANSACTIONS ||
  process.env.EXPO_PUBLIC_APPWRITE_COLLECTION_TRANSACTIONS;
const budgetsTableId =
  process.env.EXPO_PUBLIC_APPWRITE_TABLE_BUDGETS ||
  process.env.EXPO_PUBLIC_APPWRITE_COLLECTION_BUDGETS;
const categoriesTableId =
  process.env.EXPO_PUBLIC_APPWRITE_TABLE_CATEGORIES ||
  process.env.EXPO_PUBLIC_APPWRITE_COLLECTION_CATEGORIES;

export const appwriteClient = new Client();
if (endpoint && projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
}

export const databases = new Databases(appwriteClient);

export type BudgetDoc = {
  userId: string;
  monthlyBudget: number;
  currency: string;
};

export type TransactionDoc = {
  userId: string;
  title: string;
  subtitle?: string;
  amount: number; // negative for expenses, positive for income
  kind: "income" | "expense";
  categoryId: string;
  date: string; // ISO timestamp
};

export type CategoryDoc = {
  name: string;
  slug?: string;
  color?: string;
  icon?: string;
};

export async function getMonthlyBudget(userId: string) {
  if (!databaseId || !budgetsTableId) throw new Error("Appwrite env not configured");
  const res = await databases.listDocuments(databaseId, budgetsTableId, [
    Query.equal("userId", userId),
  ]);
  const doc = res.documents?.[0] as unknown as BudgetDoc | undefined;
  return doc ?? { userId, monthlyBudget: 0, currency: "USD" };
}

export async function getTransactionsForMonth(userId: string, year: number, monthIndex0: number) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59));
  const res = await databases.listDocuments(databaseId, transactionsTableId, [
    Query.equal("userId", userId),
    Query.greaterThanEqual("date", start.toISOString()),
    Query.lessThanEqual("date", end.toISOString()),
    Query.orderDesc("date"),
  ]);
  return res.documents as unknown as TransactionDoc[];
}

export async function getCategories() {
  if (!databaseId || !categoriesTableId) throw new Error("Appwrite env not configured");
  const res = await databases.listDocuments(databaseId, categoriesTableId, []);
  return res.documents as unknown as CategoryDoc[];
}
