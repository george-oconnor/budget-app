/**
 * Merchant icon utilities for displaying brand favicons
 */

// Common merchant name to domain mappings
const merchantDomains: Record<string, string> = {
  // Supermarkets
  'tesco': 'tesco.com',
  'sainsbury': 'sainsburys.co.uk',
  'sainsburys': 'sainsburys.co.uk',
  'asda': 'asda.com',
  'aldi': 'aldi.com',
  'lidl': 'lidl.com',
  'waitrose': 'waitrose.com',
  'morrisons': 'morrisons.com',
  'marks & spencer': 'marksandspencer.com',
  'm&s': 'marksandspencer.com',
  
  // Coffee & Food
  'starbucks': 'starbucks.com',
  'costa': 'costa.co.uk',
  'pret': 'pret.com',
  'greggs': 'greggs.co.uk',
  'subway': 'subway.com',
  'mcdonald': 'mcdonalds.com',
  'burger king': 'burgerking.com',
  'kfc': 'kfc.com',
  'nando': 'nandos.co.uk',
  'pizza hut': 'pizzahut.com',
  'domino': 'dominos.com',
  
  // Transport
  'uber': 'uber.com',
  'bolt': 'bolt.eu',
  'tfl': 'tfl.gov.uk',
  'trainline': 'trainline.com',
  'national rail': 'nationalrail.co.uk',
  'ryanair': 'ryanair.com',
  'easyjet': 'easyjet.com',
  'freenow': 'free-now.com',
  
  // Streaming & Entertainment
  'netflix': 'netflix.com',
  'spotify': 'spotify.com',
  'amazon prime': 'primevideo.com',
  'disney': 'disneyplus.com',
  'apple music': 'music.apple.com',
  'youtube': 'youtube.com',
  
  // Shopping
  'amazon': 'amazon.com',
  'ebay': 'ebay.com',
  'argos': 'argos.co.uk',
  'next': 'next.co.uk',
  'zara': 'zara.com',
  'h&m': 'hm.com',
  'primark': 'primark.com',
  'asos': 'asos.com',
  'john lewis': 'johnlewis.com',
  
  // Utilities & Services
  'vodafone': 'vodafone.com',
  'ee': 'ee.co.uk',
  'o2': 'o2.co.uk',
  'three': 'three.co.uk',
  'bt': 'bt.com',
  'sky': 'sky.com',
  'virgin media': 'virginmedia.com',
  
  // Gyms & Health
  'puregym': 'puregym.com',
  'gymbox': 'gymbox.com',
  'david lloyd': 'davidlloyd.co.uk',
  'boots': 'boots.com',
  'superdrug': 'superdrug.com',
  
  // Banks & Finance
  'revolut': 'revolut.com',
  'monzo': 'monzo.com',
  'starling': 'starlingbank.com',
  'hsbc': 'hsbc.com',
  'barclays': 'barclays.com',
  'lloyds': 'lloydsbank.com',
  'natwest': 'natwest.com',
  'santander': 'santander.co.uk',
  'aib': 'aib.ie',
};

/**
 * Get the domain for a merchant name
 */
function getMerchantDomain(merchantName: string): string | null {
  const normalized = merchantName.toLowerCase().trim();
  
  // Check if the merchant name itself looks like a domain (e.g., "plex.tv", "example.com")
  const domainPattern = /^[a-z0-9-]+\.(com|net|org|tv|io|co\.uk|co\.ie|ie|uk|app|dev|gg|me|us|ca|eu|de|fr|es|it|jp|au|nz)$/i;
  if (domainPattern.test(normalized)) {
    return normalized;
  }
  
  // Check exact matches first
  if (merchantDomains[normalized]) {
    return merchantDomains[normalized];
  }
  
  // Sort keys by length (longest first) to match more specific patterns first
  const sortedKeys = Object.keys(merchantDomains).sort((a, b) => b.length - a.length);
  
  // Check partial matches with word boundaries for short keys
  for (const key of sortedKeys) {
    // For very short keys (2-3 chars), require word boundaries to avoid false matches
    if (key.length <= 3) {
      // Use word boundary regex: match only if surrounded by spaces or at start/end
      const pattern = new RegExp(`(^|\\s)${key}(\\s|$)`, 'i');
      if (pattern.test(normalized)) {
        return merchantDomains[key];
      }
    } else {
      // For longer keys, simple substring match is safe
      if (normalized.includes(key)) {
        return merchantDomains[key];
      }
    }
  }
  
  // As a last resort, try appending common TLDs to the merchant name
  // Clean the merchant name (remove spaces, special chars)
  const cleanName = normalized.replace(/[^a-z0-9]/g, '');
  
  // Skip if the cleaned name is too short (likely to cause false matches)
  if (cleanName.length >= 4) {
    // Try common TLDs in order of likelihood
    const commonTLDs = ['ie', 'com', 'co.uk', 'net', 'org'];
    
    // Return the first TLD attempt - let the favicon error handler deal with failures
    // We prioritize .ie first (Irish merchants), then .com
    return `${cleanName}.${commonTLDs[0]}`;
  }
  
  return null;
}

/**
 * Get the Google Favicon URL for a merchant
 * Returns null if no domain mapping exists
 */
export function getMerchantIconUrl(merchantName: string, size: number = 64, tldIndex: number = 0): string | null {
  const domain = getMerchantDomain(merchantName);
  if (!domain) return null;
  
  // If domain already has a TLD or came from manual mapping, use it directly
  if (domain.includes('.') && tldIndex === 0) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  }
  
  // For generated domains (cleanName without TLD), try different TLDs
  const tlds = ['ie', 'com', 'co.uk'];
  if (tldIndex >= tlds.length) return null;
  
  // Remove any existing TLD from domain
  const baseDomain = domain.split('.')[0];
  const currentDomain = `${baseDomain}.${tlds[tldIndex]}`;
  
  return `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=${size}`;
}

/**
 * Check if a merchant has an icon available
 */
export function hasMerchantIcon(merchantName: string): boolean {
  return getMerchantDomain(merchantName) !== null;
}
