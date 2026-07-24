/**
 * Normalizer utility for Phone Numbers, Addresses, and Business Names
 * tailored for Indian Local SEO & Bengaluru Dental Clinics.
 */

export class NAPNormalizer {
  /**
   * Normalizes Indian phone numbers into a clean standard format (digits only, e.g. 919876543210 or 08012345678)
   */
  static normalizePhone(phone: string): string {
    if (!phone) return '';
    // Strip all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove leading 0 if 11 digits (e.g. 09876543210 -> 9876543210)
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    // Remove leading 91 prefix if 12 digits (e.g. 919876543210 -> 9876543210)
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }

  /**
   * Normalizes address strings by standardizing common Indian street abbreviations,
   * landmark indicators, and city aliases (Bangalore vs Bengaluru).
   */
  static normalizeAddress(address: string): string {
    if (!address) return '';
    let norm = address.toLowerCase();

    // City alias normalization
    norm = norm.replace(/\bbangalore\b/g, 'bengaluru');
    
    // Common street & location abbreviations
    const abbreviations: Record<string, string> = {
      '\\brd\\b': 'road',
      '\\bst\\b': 'street',
      '\\bave\\b': 'avenue',
      '\\blayt\\b': 'layout',
      '\\blys\\b': 'layout',
      '\\bflr\\b': 'floor',
      '\\bblrg\\b': 'building',
      '\\bbldg\\b': 'building',
      '\\bno\\b': 'number',
      '\\bnr\\b': 'near',
      '\\bopp\\b': 'opposite',
      '\\badj\\b': 'adjacent',
      '\\bextn\\b': 'extension',
      '\\bext\\b': 'extension',
      '\\bmain rd\\b': 'main road',
      '\\bcross rd\\b': 'cross road',
      '\\bhsr\\b': 'hsr layout',
      '\\bkora\\b': 'koramangala'
    };

    for (const [pattern, replacement] of Object.entries(abbreviations)) {
      norm = norm.replace(new RegExp(pattern, 'g'), replacement);
    }

    // Strip punctuation except spaces and numbers
    norm = norm.replace(/[^\w\s]/gi, ' ');
    // Collapse multiple spaces
    norm = norm.replace(/\s+/g, ' ').trim();

    return norm;
  }

  /**
   * Normalizes Business Name (lowercasing, removing honorifics like Dr., Clinic prefixes, special characters)
   */
  static normalizeBusinessName(name: string): string {
    if (!name) return '';
    let norm = name.toLowerCase();

    // Strip Dr. / Doctor prefix for dental practitioners
    norm = norm.replace(/\bdr\.?\s+/g, '');
    norm = norm.replace(/[^\w\s]/gi, ' ');
    norm = norm.replace(/\s+/g, ' ').trim();

    return norm;
  }

  /**
   * Computes string similarity score between 0 and 100 using Levenshtein distance
   */
  static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;

    const distance = NAPNormalizer.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity * 100) / 100;
  }

  private static levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}
