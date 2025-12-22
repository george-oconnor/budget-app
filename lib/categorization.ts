import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategories } from './appwrite';

const MERCHANT_MAPPINGS_KEY = 'budget_app_merchant_categories';

// Learned merchant-to-category mappings
interface MerchantMapping {
  [merchantKey: string]: string; // merchantKey -> categoryId
}

/**
 * Get normalized merchant key from transaction title
 */
function getMerchantKey(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Get learned merchant mappings from storage
 */
async function getLearnedMappings(): Promise<MerchantMapping> {
  try {
    const data = await AsyncStorage.getItem(MERCHANT_MAPPINGS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading merchant mappings:', error);
    return {};
  }
}

/**
 * Save a merchant-to-category mapping for future use
 */
export async function learnMerchantCategory(merchantName: string, categoryId: string): Promise<void> {
  try {
    const mappings = await getLearnedMappings();
    const key = getMerchantKey(merchantName);
    mappings[key] = categoryId;
    await AsyncStorage.setItem(MERCHANT_MAPPINGS_KEY, JSON.stringify(mappings));
  } catch (error) {
    console.error('Error saving merchant mapping:', error);
  }
}

/**
 * Keyword-based category matching rules
 * Returns categoryId or null if no match
 */
function matchKeywordRules(description: string, isExpense: boolean): string | null {
  const desc = description.toLowerCase();

  // Food & Dining keywords
  if (
    desc.includes('restaurant') ||
    desc.includes('cafe') ||
    desc.includes('coffee') ||
    desc.includes('pizza') ||
    desc.includes('burger') ||
    desc.includes('mcdonald') ||
    desc.includes('kfc') ||
    desc.includes('subway') ||
    desc.includes('starbucks') ||
    desc.includes('costa') ||
    desc.includes('nando') ||
    desc.includes('greggs') ||
    desc.includes('pret')
  ) {
    return 'food';
  }

  // Groceries
  if (
    desc.includes('grocery') ||
    desc.includes('supermarket') ||
    desc.includes('sainsbury') ||
    desc.includes('tesco') ||
    desc.includes('asda') ||
    desc.includes('waitrose') ||
    desc.includes('aldi') ||
    desc.includes('lidl') ||
    desc.includes('morrisons') ||
    desc.includes('coop') ||
    desc.includes('co-op') ||
    desc.includes('marks & spencer') ||
    desc.includes('m&s food')
  ) {
    return 'groceries';
  }

  // Transport
  if (
    desc.includes('uber') ||
    desc.includes('lyft') ||
    desc.includes('taxi') ||
    desc.includes('train') ||
    desc.includes('bus') ||
    desc.includes('tube') ||
    desc.includes('metro') ||
    desc.includes('tfl') ||
    desc.includes('transport for london') ||
    desc.includes('national rail') ||
    desc.includes('trainline') ||
    desc.includes('citymapper')
  ) {
    return 'transport';
  }

  // Entertainment
  if (
    desc.includes('cinema') ||
    desc.includes('movie') ||
    desc.includes('theatre') ||
    desc.includes('concert') ||
    desc.includes('spotify') ||
    desc.includes('netflix') ||
    desc.includes('amazon prime') ||
    desc.includes('disney') ||
    desc.includes('apple music') ||
    desc.includes('youtube premium')
  ) {
    return 'entertainment';
  }

  // Shopping
  if (
    desc.includes('amazon') ||
    desc.includes('ebay') ||
    desc.includes('shop') ||
    desc.includes('store') ||
    desc.includes('retail') ||
    desc.includes('zara') ||
    desc.includes('h&m') ||
    desc.includes('primark') ||
    desc.includes('next') ||
    desc.includes('argos') ||
    desc.includes('john lewis')
  ) {
    return 'shopping';
  }

  // Utilities
  if (
    desc.includes('electric') ||
    desc.includes('gas') ||
    desc.includes('water') ||
    desc.includes('internet') ||
    desc.includes('broadband') ||
    desc.includes('phone bill') ||
    desc.includes('mobile') ||
    desc.includes('vodafone') ||
    desc.includes('ee ') ||
    desc.includes('o2') ||
    desc.includes('three') ||
    desc.includes('bt ')
  ) {
    return 'utilities';
  }

  // Health
  if (
    desc.includes('pharmacy') ||
    desc.includes('chemist') ||
    desc.includes('doctor') ||
    desc.includes('hospital') ||
    desc.includes('dental') ||
    desc.includes('gym') ||
    desc.includes('fitness') ||
    desc.includes('boots') ||
    desc.includes('superdrug')
  ) {
    return 'health';
  }

  // Transfers/Income (not expenses)
  if (!isExpense) {
    if (
      desc.includes('salary') ||
      desc.includes('wage') ||
      desc.includes('payment received') ||
      desc.includes('transfer from')
    ) {
      return 'income';
    }
  }

  return null; // No keyword match
}

/**
 * Categorize a transaction based on its title/description
 * Uses learned mappings first, then keyword rules, finally falls back to uncategorized
 */
export async function categorizeTransaction(
  title: string,
  description: string,
  isExpense: boolean
): Promise<string> {
  // 1. Check learned merchant mappings
  const merchantKey = getMerchantKey(title);
  const learnedMappings = await getLearnedMappings();
  
  if (learnedMappings[merchantKey]) {
    return learnedMappings[merchantKey];
  }

  // 2. Try keyword matching on both title and description
  const combinedText = `${title} ${description}`;
  const keywordMatch = matchKeywordRules(combinedText, isExpense);
  
  if (keywordMatch) {
    return keywordMatch;
  }

  // 3. Fall back to uncategorized
  return 'uncategorized';
}

/**
 * Get or create the "uncategorized" category
 * This ensures we always have a fallback category
 */
export async function ensureUncategorizedCategory(): Promise<string> {
  try {
    const categories = await getCategories();
    const uncategorized = categories.find(c => c.id === 'uncategorized' || c.name.toLowerCase() === 'uncategorized');
    
    if (uncategorized) {
      return uncategorized.id;
    }
    
    // If no uncategorized category exists, return 'uncategorized' 
    // (it should be created in the database)
    return 'uncategorized';
  } catch (error) {
    console.error('Error checking for uncategorized category:', error);
    return 'uncategorized';
  }
}
