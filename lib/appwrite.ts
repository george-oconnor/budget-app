import { Account, Client, Databases, ID, Query } from "appwrite";

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
const usersTableId =
  process.env.EXPO_PUBLIC_APPWRITE_TABLE_USERS ||
  process.env.EXPO_PUBLIC_APPWRITE_COLLECTION_USERS;

export const appwriteClient = new Client();
if (endpoint && projectId) {
  appwriteClient.setEndpoint(endpoint).setProject(projectId);
}

export const databases = new Databases(appwriteClient);
export const account = new Account(appwriteClient);

// Auth functions
export async function createAccount(email: string, password: string, name: string) {
  return await account.create(ID.unique(), email, password, name);
}

export async function signIn(email: string, password: string) {
  return await account.createEmailPasswordSession(email, password);
}

export async function signOut() {
  return await account.deleteSession("current");
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  try {
    return await account.getSession("current");
  } catch {
    return null;
  }
}

// Password Recovery functions
export async function requestPasswordReset(email: string, resetUrl: string) {
  return await account.createRecovery(email, resetUrl);
}

export async function completePasswordReset(userId: string, secret: string, newPassword: string) {
  return await account.updateRecovery(userId, secret, newPassword, newPassword);
}

export type UserDoc = {
  userId: string; // Appwrite auth user ID
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
};

export async function createUserProfile(
  userId: string,
  email: string,
  firstName: string,
  lastName: string
) {
  if (!databaseId || !usersTableId) throw new Error("Appwrite env not configured");
  return await databases.createDocument(databaseId, usersTableId, userId, {
    userId,
    email,
    firstname: firstName,
    lastname: lastName,
  });
}

export async function getUserProfile(userId: string) {
  if (!databaseId || !usersTableId) throw new Error("Appwrite env not configured");
  try {
    return await databases.getDocument(databaseId, usersTableId, userId) as unknown as UserDoc;
  } catch {
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  data: Partial<Omit<UserDoc, "userId" | "createdAt">>
) {
  if (!databaseId || !usersTableId) throw new Error("Appwrite env not configured");
  return await databases.updateDocument(databaseId, usersTableId, userId, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

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
