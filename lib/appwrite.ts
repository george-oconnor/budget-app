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
  try {
    return await account.deleteSession("current");
  } catch (err) {
    console.error("signOut error:", err);
    throw err;
  }
}

export async function clearAllSessions() {
  try {
    return await account.deleteSessions();
  } catch (err) {
    console.error("clearAllSessions error:", err);
    throw err;
  }
}

export async function getCurrentUser() {
  try {
    const user = await account.get();
    // Verify user is valid by checking their ID
    if (!user || !user.$id) {
      return null;
    }
    return user;
  } catch (err) {
    console.error("getCurrentUser error:", err);
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
  return await account.updateRecovery(userId, secret, newPassword);
}

export type UserDoc = {
  userId: string; // Appwrite auth user ID
  email: string;
  firstName: string;
  lastName: string;
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
    const doc = await databases.getDocument(databaseId, usersTableId, userId);
    const profile: UserDoc = {
      userId: doc.userId,
      email: doc.email,
      firstName: doc.firstname,
      lastName: doc.lastname,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    console.log("getUserProfile - fetched:", { 
      userId, 
      hasProfile: !!profile,
      firstName: profile.firstName,
      lastName: profile.lastName
    });
    return profile;
  } catch (err) {
    console.error("getUserProfile - error:", userId, err);
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
  cycleType?: "first_working_day" | "last_working_day" | "specific_date" | "last_friday"; // When budget cycle starts/ends
  cycleDay?: number; // For specific_date: 1-31
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

export async function updateMonthlyBudget(
  userId: string,
  monthlyBudget: number,
  currency: string = "USD",
  cycleType: "first_working_day" | "last_working_day" | "specific_date" | "last_friday" = "first_working_day",
  cycleDay?: number
) {
  if (!databaseId || !budgetsTableId) throw new Error("Appwrite env not configured");
  
  // Check if budget doc exists
  const res = await databases.listDocuments(databaseId, budgetsTableId, [
    Query.equal("userId", userId),
  ]);
  const existingDoc = res.documents?.[0] as any;
  
  const budgetData: any = {
    monthlyBudget,
    currency,
    cycleType,
  };
  
  // Only add cycleDay if it's a specific_date type
  if (cycleType === "specific_date" && cycleDay) {
    budgetData.cycleDay = cycleDay;
  }
  
  if (existingDoc) {
    // Update existing
    return await databases.updateDocument(databaseId, budgetsTableId, existingDoc.$id, budgetData);
  } else {
    // Create new
    return await databases.createDocument(databaseId, budgetsTableId, ID.unique(), {
      userId,
      ...budgetData,
    });
  }
}

export async function getTransactionsForMonth(userId: string, year: number, monthIndex0: number) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");
  const start = new Date(Date.UTC(year, monthIndex0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59));
  const res = await databases.listDocuments(databaseId, transactionsTableId, [
    Query.equal("userId", userId),
    Query.greaterThanEqual("date", start.toISOString()),
    Query.lessThanEqual("date", end.toISOString()),
    Query.limit(500),
    Query.orderDesc("date"),
  ]);
  return res.documents as unknown as TransactionDoc[];
}

export async function getTransactionsInRange(userId: string, startISO: string, endISO: string) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");
  const res = await databases.listDocuments(databaseId, transactionsTableId, [
    Query.equal("userId", userId),
    Query.greaterThanEqual("date", startISO),
    Query.lessThanEqual("date", endISO),
    Query.limit(500),
    Query.orderDesc("date"),
  ]);
  return res.documents as unknown as TransactionDoc[];
}

// Fetch all transactions in range with pagination to avoid missing duplicates
export async function getTransactionsInRangeAll(userId: string, startISO: string, endISO: string) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");

  const all: any[] = [];
  const limit = 500;
  let cursor: string | undefined;

  while (true) {
    const queries: any[] = [
      Query.equal("userId", userId),
      Query.greaterThanEqual("date", startISO),
      Query.lessThanEqual("date", endISO),
      Query.limit(limit),
      Query.orderDesc("date"),
    ];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const res = await databases.listDocuments(databaseId, transactionsTableId, queries);
    const docs = res.documents || [];
    all.push(...docs);

    if (docs.length < limit) break;
    cursor = docs[docs.length - 1]?.$id;
    if (!cursor) break;
  }

  return all as unknown as TransactionDoc[];
}

// Fetch every transaction for a user (paginated) for global dedupe comparisons
export async function getAllTransactionsForUser(userId: string) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");

  const all: any[] = [];
  const limit = 500;
  let cursor: string | undefined;

  while (true) {
    const queries: any[] = [
      Query.equal("userId", userId),
      Query.orderAsc("$id"),
      Query.limit(limit),
    ];

    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }

    const res = await databases.listDocuments(databaseId, transactionsTableId, queries);
    const docs = res.documents || [];
    all.push(...docs);

    if (docs.length < limit) break;
    cursor = docs[docs.length - 1]?.$id;
    if (!cursor) break;
  }

  return all as unknown as TransactionDoc[];
}

export async function getCategories() {
  if (!databaseId || !categoriesTableId) throw new Error("Appwrite env not configured");
  const res = await databases.listDocuments(databaseId, categoriesTableId, []);
  return res.documents as unknown as CategoryDoc[];
}

export async function createTransaction(
  userId: string,
  title: string,
  subtitle: string | undefined,
  amount: number,
  kind: "income" | "expense",
  categoryId: string,
  date: string
) {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");
  
  return await databases.createDocument(databaseId, transactionsTableId, ID.unique(), {
    userId,
    title,
    subtitle: subtitle || "",
    amount,
    kind,
    categoryId,
    date,
  });
}

export type BulkCreateResult = {
  created: number;
  failed: number;
  errors: Array<{ message: string; title?: string; date?: string }>;
};

export async function createBulkTransactions(
  userId: string,
  transactions: Array<{
    title: string;
    subtitle?: string;
    amount: number;
    kind: "income" | "expense";
    categoryId: string;
    date: string;
  }>,
  onProgress?: (current: number, total: number) => void,
  shouldCancel?: () => boolean
): Promise<BulkCreateResult> {
  if (!databaseId || !transactionsTableId) throw new Error("Appwrite env not configured");
  
  const errors: BulkCreateResult["errors"] = [];
  let created = 0;
  const BATCH_SIZE = 2; // Process 2 transactions at a time to avoid rate limits
  const DELAY_MS = 2000; // 2 second delay between batches
  
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    if (shouldCancel?.()) {
      break;
    }
    const batch = transactions.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (tx) => {
      if (shouldCancel?.()) return null;
      try {
        const res = await createTransaction(
          userId,
          tx.title,
          tx.subtitle,
          tx.amount,
          tx.kind,
          tx.categoryId,
          tx.date
        );
        return res;
      } catch (err: any) {
        const message = err?.message || "Unknown error";
        errors.push({ message, title: tx.title, date: tx.date });
        console.error("Error creating transaction:", message, tx.title, tx.date);
        return null;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    created += batchResults.filter(r => r !== null).length;
    
    // Report progress based on attempted items
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, transactions.length), transactions.length);
    }
    
    // Add delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return { created, failed: errors.length, errors };
}

