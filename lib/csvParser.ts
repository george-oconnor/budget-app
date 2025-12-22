// Revolut CSV format parser
// Expected columns: Started Date,Completed Date,Description,Payer,Payee,Amount,Fee,Currency,State,Balance

export interface RevolutTransaction {
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
  kind: "income" | "expense";
  date: string; // ISO format
  categoryId: string; // default category
}

export type SkippedRow = { line: number; reason: string };

export type RevolutParseResult = {
  transactions: RevolutTransaction[];
  skipped: number; // rows skipped due to invalid structure
  totalRows: number; // data rows (excluding header)
  skippedDetails: SkippedRow[];
};

export function parseRevolutCSV(csvContent: string): RevolutParseResult {
  const rawLines = csvContent.split("\n");
  // Preserve empty trailing lines in counts but ignore them for parsing
  const lines = rawLines.map((l) => l.replace(/\r$/, ""));
  
  if (lines.length < 2) {
    throw new Error("CSV file is empty or invalid");
  }

  // Parse header to get column indices
  const headerFields = parseCSVLine(lines[0]);
  const columnMap = new Map<string, number>();
  headerFields.forEach((header, index) => {
    columnMap.set(header.trim().toLowerCase(), index);
  });

  // Find required columns
  const getColumnIndex = (names: string[]): number => {
    for (const name of names) {
      const index = columnMap.get(name.toLowerCase());
      if (index !== undefined) return index;
    }
    return -1;
  };

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

  // Parse data lines
  const transactions: RevolutTransaction[] = [];
  let skipped = 0;
  const skippedDetails: SkippedRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skipped++;
      skippedDetails.push({ line: i + 1, reason: "Empty line" });
      continue; // Skip empty lines but count them
    }

    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line);
    
    if (fields.length < 3) {
      console.warn(`Skipping invalid line ${i + 1}: not enough fields`);
      skipped++;
      skippedDetails.push({ line: i + 1, reason: "Not enough columns" });
      continue;
    }

    try {
      const startedDate = startedDateIdx >= 0 ? fields[startedDateIdx]?.trim() || '' : '';
      const completedDate = completedDateIdx >= 0 ? fields[completedDateIdx]?.trim() || '' : '';
      const description = descriptionIdx >= 0 ? fields[descriptionIdx]?.trim() || '' : '';
      const amount = amountIdx >= 0 ? parseFloat(fields[amountIdx]?.trim() || '0') : 0;
      if (Number.isNaN(amount)) {
        skipped++;
        skippedDetails.push({ line: i + 1, reason: "Invalid amount" });
        continue;
      }
      const fee = feeIdx >= 0 ? parseFloat(fields[feeIdx]?.trim() || '0') : 0;
      const currency = currencyIdx >= 0 ? fields[currencyIdx]?.trim() || 'GBP' : 'GBP';
      const state = stateIdx >= 0 ? fields[stateIdx]?.trim() || '' : '';
      const balance = balanceIdx >= 0 ? fields[balanceIdx]?.trim() || '' : '';

      transactions.push({
        startedDate,
        completedDate,
        description,
        payer: '', // Not always in Revolut CSV
        payee: '', // Not always in Revolut CSV
        amount,
        fee,
        currency,
        state,
        balance,
      });
    } catch (e) {
      console.warn(`Error parsing line ${i + 1}:`, e);
      skipped++;
      skippedDetails.push({ line: i + 1, reason: "Parse error" });
      continue;
    }
  }

  const totalRows = Math.max(0, lines.length - 1); // exclude header
  return { transactions, skipped, totalRows, skippedDetails };
}

export function convertRevolutToAppTransaction(
  revolut: RevolutTransaction
): ParsedTransaction {
  // Determine if income or expense based on amount
  const isExpense = revolut.amount < 0;
  const absoluteAmount = Math.abs(revolut.amount);
  const amountInCents = Math.round(absoluteAmount * 100);

  // Use completed date, fallback to started date
  const dateStr = revolut.completedDate || revolut.startedDate;
  let date: Date;
  
  try {
    // Try parsing the date string
    date = new Date(dateStr);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date for transaction: ${dateStr}, using current date`);
      date = new Date();
    }
  } catch (e) {
    console.warn(`Error parsing date: ${dateStr}, using current date`);
    date = new Date();
  }
  
  // Determine title and subtitle
  let title = revolut.description;
  let subtitle = isExpense ? revolut.payee : revolut.payer;

  // If description is empty, use payee/payer
  if (!title || title.toLowerCase() === "transfer") {
    title = isExpense ? revolut.payee : revolut.payer;
    subtitle = revolut.description || (isExpense ? "Expense" : "Income");
  }

  return {
    title: title || (isExpense ? "Expense" : "Income"),
    subtitle: subtitle || revolut.description || "",
    amount: amountInCents, // Always positive, kind field indicates income/expense
    kind: isExpense ? "expense" : "income",
    date: date.toISOString(),
    categoryId: categorizeTransaction(revolut.description, isExpense),
  };
}

function categorizeTransaction(description: string, isExpense: boolean): string {
  const desc = description.toLowerCase();

  // Map common Revolut transaction types to categories
  const categoryMap: { [key: string]: string } = {
    // Food & Dining
    "restaurant": "food",
    "cafe": "food",
    "pizza": "food",
    "burger": "food",
    "grocery": "food",
    "supermarket": "food",
    "sainsbury": "food",
    "tesco": "food",
    "asda": "food",
    "waitrose": "food",

    // Transport
    "uber": "transport",
    "lyft": "transport",
    "taxi": "transport",
    "shell": "transport",
    "bp": "transport",
    "petrol": "transport",
    "parking": "transport",
    "train": "transport",
    "bus": "transport",

    // Shopping
    "amazon": "shopping",
    "ebay": "shopping",
    "asos": "shopping",
    "primark": "shopping",
    "zara": "shopping",
    "h&m": "shopping",
    "boots": "shopping",
    "next": "shopping",

    // Bills & Utilities
    "electricity": "bills",
    "water": "bills",
    "gas": "bills",
    "broadband": "bills",
    "internet": "bills",
    "phone": "bills",
    "insurance": "bills",

    // Entertainment
    "spotify": "entertainment",
    "netflix": "entertainment",
    "cinema": "entertainment",
    "movie": "entertainment",
    "theatre": "entertainment",
    "concert": "entertainment",
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (desc.includes(keyword)) {
      return category;
    }
  }

  // Default categories
  return isExpense ? "expense" : "income";
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Push the last field
  result.push(current);

  return result;
}
