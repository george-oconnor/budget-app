// Revolut CSV format parser
// Expected columns: Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance

import { categorizeTransaction, getTransferCategoryId } from './categorization';

export interface RevolutTransaction {
  type: string; // e.g., "Transfer", "Card Payment", "Topup"
  product: string; // e.g., "Current", "Pocket", "Savings"
  startedDate: string;
  completedDate: string;
  description: string;
  payer: string;
  payee: string;
  amount: number;
  fee: number;
  currency: string;
  state: string;
  balance: string;
}

export interface ParsedTransaction {
  title: string;
  subtitle: string;
  amount: number; // in cents, negative for expenses, positive for income
  kind: 'income' | 'expense';
  date: string; // ISO format
  categoryId: string;
  currency: string; // e.g., 'EUR', 'GBP', 'USD'
  excludeFromAnalytics?: boolean;
  isAnalyticsProtected?: boolean; // When true, user cannot toggle excludeFromAnalytics
}

export type SkippedRow = { line: number; reason: string };

export type RevolutParseResult = {
  transactions: RevolutTransaction[];
  skipped: number;
  totalRows: number;
  skippedDetails: SkippedRow[];
};

export interface AibTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  balance: string;
  product: string;
}

export type AibParseResult = {
  transactions: AibTransaction[];
  skipped: number;
  totalRows: number;
  skippedDetails: SkippedRow[];
};

export function parseRevolutCSV(csvContent: string): RevolutParseResult {
  const rawLines = csvContent.split('\n');
  const lines = rawLines.map(l => l.replace(/\r$/, ''));

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headerFields = parseCSVLine(lines[0]);
  const columnMap = new Map<string, number>();
  headerFields.forEach((header, index) => {
    columnMap.set(header.trim().toLowerCase(), index);
  });

  const getColumnIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = columnMap.get(name.toLowerCase());
      if (idx !== undefined) return idx;
    }
    return -1;
  };

  const typeIdx = getColumnIndex(['type']);
  const productIdx = getColumnIndex(['product']);
  const startedDateIdx = getColumnIndex(['started date', 'started', 'date']);
  const completedDateIdx = getColumnIndex(['completed date', 'completed']);
  const descriptionIdx = getColumnIndex(['description', 'desc']);
  const amountIdx = getColumnIndex(['amount']);
  const feeIdx = getColumnIndex(['fee']);
  const currencyIdx = getColumnIndex(['currency']);
  const stateIdx = getColumnIndex(['state', 'status']);
  const balanceIdx = getColumnIndex(['balance']);

  if (amountIdx === -1) {
    throw new Error("CSV must contain 'Amount' column");
  }

  const transactions: RevolutTransaction[] = [];
  let skipped = 0;
  const skippedDetails: SkippedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Empty line' });
      continue;
    }

    const fields = parseCSVLine(line);
    if (fields.length < 3) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Not enough columns' });
      continue;
    }

    try {
      const type = typeIdx >= 0 ? fields[typeIdx]?.trim() || '' : '';
      const product = productIdx >= 0 ? fields[productIdx]?.trim() || '' : '';
      const startedDate = startedDateIdx >= 0 ? fields[startedDateIdx]?.trim() || '' : '';
      const completedDate = completedDateIdx >= 0 ? fields[completedDateIdx]?.trim() || '' : '';
      const description = descriptionIdx >= 0 ? fields[descriptionIdx]?.trim() || '' : '';
      const amount = amountIdx >= 0 ? parseFloat(fields[amountIdx]?.trim() || '0') : 0;
      if (Number.isNaN(amount)) {
        skipped++;
        skippedDetails.push({ line: i + 1, reason: 'Invalid amount' });
        continue;
      }
      const fee = feeIdx >= 0 ? parseFloat(fields[feeIdx]?.trim() || '0') : 0;
      const currency = currencyIdx >= 0 ? fields[currencyIdx]?.trim() || 'GBP' : 'GBP';
      const state = stateIdx >= 0 ? fields[stateIdx]?.trim() || '' : '';
      const balance = balanceIdx >= 0 ? fields[balanceIdx]?.trim() || '' : '';

      transactions.push({
        type,
        product,
        startedDate,
        completedDate,
        description,
        payer: '',
        payee: '',
        amount,
        fee,
        currency,
        state,
        balance,
      });
    } catch (e) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Parse error' });
      continue;
    }
  }

  const totalRows = Math.max(0, lines.length - 1);
  return { transactions, skipped, totalRows, skippedDetails };
}

export async function convertRevolutToAppTransaction(
  revolut: RevolutTransaction
): Promise<ParsedTransaction> {
  const isExpense = revolut.amount < 0;
  const amountInCents = Math.round(Math.abs(revolut.amount) * 100);

  // Prefer Started Date, normalize "YYYY-MM-DD HH:mm:ss" to ISO-like local time
  const primaryStr = revolut.startedDate || '';
  const fallbackStr = revolut.completedDate || '';
  const normalizedPrimary = primaryStr ? primaryStr.replace(' ', 'T') : '';
  const normalizedFallback = fallbackStr ? fallbackStr.replace(' ', 'T') : '';

  let date = normalizedPrimary ? new Date(normalizedPrimary) : new Date(NaN);
  if (isNaN(date.getTime())) {
    date = normalizedFallback ? new Date(normalizedFallback) : new Date();
  }

  let title = revolut.description;
  let subtitle = isExpense ? revolut.payee : revolut.payer;

  if (!title || title.toLowerCase() === 'transfer') {
    title = isExpense ? revolut.payee : revolut.payer;
    subtitle = revolut.description || (isExpense ? 'Expense' : 'Income');
  }

  const categoryId = await categorizeTransaction(title || '', subtitle || '', isExpense);

  return {
    title: title || (isExpense ? 'Expense' : 'Income'),
    subtitle: subtitle || revolut.description || '',
    amount: amountInCents,
    kind: isExpense ? 'expense' : 'income',
    date: date.toISOString(),
    categoryId,
    currency: revolut.currency || 'EUR',
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Detect transfer pairs: transactions with matching amounts on the same date
 * Returns a Set of transaction indices that are part of transfer pairs
 * 
 * A transfer pair consists of:
 * - Two transactions on the same date (or within 1 day)
 * - Same absolute amount
 * - One income and one expense
 * - Same currency
 */
export function detectTransferPairs(transactions: ParsedTransaction[]): Set<number> {
  const transferIndices = new Set<number>();
  
  // Create a map of potential matches: date_amount_currency -> indices
  const potentialMatches = new Map<string, number[]>();
  
  transactions.forEach((tx, index) => {
    const dateObj = new Date(tx.date);
    const dateKey = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
    const key = `${dateKey}_${tx.amount}_${tx.currency}`;
    
    if (!potentialMatches.has(key)) {
      potentialMatches.set(key, []);
    }
    potentialMatches.get(key)!.push(index);
  });
  
  // Check each group for income/expense pairs
  potentialMatches.forEach((indices) => {
    if (indices.length < 2) return;
    
    // Find all income/expense pairs in this group
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const tx1 = transactions[indices[i]];
        const tx2 = transactions[indices[j]];
        
        // Check if one is income and one is expense
        if (tx1.kind !== tx2.kind) {
          // Check if dates are within 1 day of each other
          const date1 = new Date(tx1.date).getTime();
          const date2 = new Date(tx2.date).getTime();
          const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
          
          if (daysDiff <= 1) {
            transferIndices.add(indices[i]);
            transferIndices.add(indices[j]);
          }
        }
      }
    }
  });
  
  return transferIndices;
}

/**
 * Mark transfer transactions with special category and analytics protection
 * This should be called after parsing but before saving transactions
 */
export async function markTransfers(transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> {
  const transferIndices = detectTransferPairs(transactions);
  
  if (transferIndices.size === 0) {
    return transactions;
  }
  
  const transferCategoryId = await getTransferCategoryId();
  
  return transactions.map((tx, index) => {
    if (transferIndices.has(index)) {
      return {
        ...tx,
        categoryId: transferCategoryId,
        excludeFromAnalytics: true,
        isAnalyticsProtected: true,
      };
    }
    return tx;
  });
}

// AIB CSV format parser (tolerant to common formats). Expected columns include at least a date and either Amount or Debit/Credit.
export function parseAibCSV(csvContent: string): AibParseResult {
  const rawLines = csvContent.split('\n');
  const lines = rawLines.map(l => l.replace(/\r$/, ''));

  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headerFields = parseCSVLine(lines[0].replace(/^\uFEFF/, ''));
  const normalizedHeaders = headerFields.map(h => h.trim().toLowerCase());

  const getColumnIndex = (aliases: string[]): number => {
    for (const alias of aliases) {
      const exactIdx = normalizedHeaders.findIndex(h => h === alias.toLowerCase());
      if (exactIdx !== -1) return exactIdx;
      const containsIdx = normalizedHeaders.findIndex(h => h.includes(alias.toLowerCase()));
      if (containsIdx !== -1) return containsIdx;
    }
    return -1;
  };

  const dateIdx = getColumnIndex([
    'date',
    'transaction date',
    'value date',
    'posting date',
    'posted date',
    'posted transactions date',
  ]);
  const descIdx = getColumnIndex(['description', 'details', 'narrative', 'info', 'reference']);
  const amountIdx = getColumnIndex(['amount', 'transaction amount']);
  const debitIdx = getColumnIndex(['debit', 'withdrawal', 'debit amount', 'debit eur']);
  const creditIdx = getColumnIndex(['credit', 'lodgement', 'credit amount', 'credit eur']);
  const currencyIdx = getColumnIndex(['currency', 'ccy']);
  const balanceIdx = getColumnIndex(['balance', 'running balance', 'balance eur']);
  const productIdx = getColumnIndex(['account', 'account name', 'account type', 'account product']);

  if (dateIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) {
    throw new Error("CSV must contain date and amount (or debit/credit) columns");
  }

  const transactions: AibTransaction[] = [];
  let skipped = 0;
  const skippedDetails: SkippedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Empty line' });
      continue;
    }

    const fields = parseCSVLine(line);
    if (fields.length < 2) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Not enough columns' });
      continue;
    }

    try {
      const rawDate = dateIdx >= 0 ? fields[dateIdx]?.trim() || '' : '';
      const description = descIdx >= 0 ? fields[descIdx]?.trim() || '' : '';

      let amount = 0;
      if (amountIdx >= 0 && fields[amountIdx]) {
        amount = parseFloat(fields[amountIdx].trim().replace(/,/g, ''));
      } else {
        const debit = debitIdx >= 0 ? parseFloat(fields[debitIdx]?.trim().replace(/,/g, '') || '0') : 0;
        const credit = creditIdx >= 0 ? parseFloat(fields[creditIdx]?.trim().replace(/,/g, '') || '0') : 0;
        if (!Number.isNaN(debit) && debit !== 0) amount = -Math.abs(debit);
        else if (!Number.isNaN(credit) && credit !== 0) amount = Math.abs(credit);
      }

      if (Number.isNaN(amount)) {
        skipped++;
        skippedDetails.push({ line: i + 1, reason: 'Invalid amount' });
        continue;
      }

      const currency = currencyIdx >= 0 ? fields[currencyIdx]?.trim() || 'EUR' : 'EUR';
      const balance = balanceIdx >= 0 ? fields[balanceIdx]?.trim() || '' : '';
      const product = productIdx >= 0 ? fields[productIdx]?.trim() || '' : 'AIB';

      transactions.push({
        date: rawDate,
        description,
        amount,
        currency,
        balance,
        product,
      });
    } catch (e) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: 'Parse error' });
      continue;
    }
  }

  const totalRows = Math.max(0, lines.length - 1);
  return { transactions, skipped, totalRows, skippedDetails };
}

export async function convertAibToAppTransaction(aib: AibTransaction): Promise<ParsedTransaction> {
  const isExpense = aib.amount < 0;
  const amountInCents = Math.round(Math.abs(aib.amount) * 100);

  // AIB dates are typically DD/MM/YYYY or DD/MM/YY, parse them correctly
  let date = new Date(NaN);
  if (aib.date) {
    const trimmed = aib.date.trim();
    // Try DD/MM/YYYY or DD/MM/YY format (AIB standard)
    const dateMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      // Handle 2-digit year: assume 20xx for 00-99
      const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
      date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    } else {
      // Try ISO or other formats
      const normalized = trimmed.replace(' ', 'T');
      date = new Date(normalized);
    }
  }
  
  if (isNaN(date.getTime())) {
    console.warn('Failed to parse AIB date:', aib.date, '- using current date as fallback');
    date = new Date();
  }

  const title = aib.description || (isExpense ? 'Expense' : 'Income');
  const subtitle = aib.product || 'AIB';
  const categoryId = await categorizeTransaction(title, subtitle, isExpense);

  return {
    title,
    subtitle,
    amount: amountInCents,
    kind: isExpense ? 'expense' : 'income',
    date: date.toISOString(),
    categoryId,
    currency: aib.currency || 'EUR',
  };
}
