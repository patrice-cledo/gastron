/**
 * Ingredient Normalization and Canonicalization
 * 
 * This module handles:
 * - Converting raw ingredient text to canonical keys
 * - Deduplication logic
 * - Unit normalization
 * - Synonym mapping
 */

import { IngredientLine } from './types';

/**
 * Normalize a string to a canonical key for deduplication
 */
export function normalizeToCanonicalKey(text: string): string {
  let normalized = text.toLowerCase().trim();
  
  // Remove punctuation
  normalized = normalized.replace(/[.,;:!?'"()]/g, '');
  
  // Basic pluralization (simple cases)
  normalized = singularize(normalized);
  
  // Remove common modifiers from key (keep in parsed data)
  const modifiers = ['fresh', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'crushed', 'whole', 'halved', 'quartered'];
  modifiers.forEach(mod => {
    const regex = new RegExp(`\\b${mod}\\b`, 'gi');
    normalized = normalized.replace(regex, '').trim();
  });
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Simple singularization (handles common cases)
 */
function singularize(text: string): string {
  // Basic rules - can be expanded
  if (text.endsWith('ies')) {
    return text.slice(0, -3) + 'y';
  }
  if (text.endsWith('es') && text.length > 3) {
    // Check if it's a plural (onions -> onion, but not "rice")
    const withoutEs = text.slice(0, -2);
    if (['onion', 'pepper', 'tomato'].some(word => withoutEs.includes(word))) {
      return withoutEs;
    }
  }
  if (text.endsWith('s') && text.length > 2 && !text.endsWith('ss')) {
    return text.slice(0, -1);
  }
  return text;
}

/**
 * Synonym mapping - maps common ingredient variants to canonical names
 */
const SYNONYM_MAP: Record<string, string> = {
  'scallion': 'green onion',
  'green onion': 'green onion',
  'spring onion': 'green onion',
  'cilantro': 'coriander',
  'coriander': 'coriander',
  'bell pepper': 'bell pepper',
  'capsicum': 'bell pepper',
  'sweet pepper': 'bell pepper',
  'ground beef': 'ground beef',
  'minced beef': 'ground beef',
  'hamburger': 'ground beef',
};

/**
 * Get canonical name from synonym map
 */
export function getCanonicalName(name: string): string {
  const normalized = name.toLowerCase().trim();
  return SYNONYM_MAP[normalized] || normalized;
}

/**
 * Normalize unit names
 */
export function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  
  const normalized = unit.toLowerCase().trim();
  
  const unitMap: Record<string, string> = {
    'tbsp': 'tablespoon',
    'tbs': 'tablespoon',
    'tablespoon': 'tablespoon',
    'tablespoons': 'tablespoon',
    'tsp': 'teaspoon',
    'teaspoon': 'teaspoon',
    'teaspoons': 'teaspoon',
    'cup': 'cup',
    'cups': 'cup',
    'c': 'cup',
    'oz': 'ounce',
    'ounce': 'ounce',
    'ounces': 'ounce',
    'lb': 'pound',
    'lbs': 'pound',
    'pound': 'pound',
    'pounds': 'pound',
    'g': 'gram',
    'gram': 'gram',
    'grams': 'gram',
    'kg': 'kilogram',
    'kilogram': 'kilogram',
    'kilograms': 'kilogram',
    'ml': 'milliliter',
    'milliliter': 'milliliter',
    'milliliters': 'milliliter',
    'l': 'liter',
    'liter': 'liter',
    'liters': 'liter',
    'each': 'each',
    'piece': 'each',
    'pieces': 'each',
    'item': 'each',
    'items': 'each',
  };
  
  return unitMap[normalized] || normalized;
}

/**
 * Extract modifiers from ingredient text
 */
export function extractModifiers(text: string): string[] {
  const modifiers: string[] = [];
  const modifierWords = [
    'fresh', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'crushed',
    'whole', 'halved', 'quartered', 'julienned', 'cubed', 'shredded',
    'peeled', 'seeded', 'stemmed', 'trimmed', 'boneless', 'skinless'
  ];
  
  const lowerText = text.toLowerCase();
  modifierWords.forEach(mod => {
    if (lowerText.includes(mod)) {
      modifiers.push(mod);
    }
  });
  
  return modifiers;
}

/**
 * Parse ingredient line from raw text
 * This is a simplified parser - can be enhanced with NLP libraries
 */
export function parseIngredientLine(rawText: string): IngredientLine['parsed'] {
  const text = rawText.trim();
  
  // Extract quantity (numbers at the start)
  const quantityMatch = text.match(/^(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)/);
  let quantity: number | null = null;
  let remainingText = text;
  
  if (quantityMatch) {
    const qtyStr = quantityMatch[1];
    // Handle fractions like "1/2" or "1 1/2"
    if (qtyStr.includes('/')) {
      const parts = qtyStr.split(/\s+/);
      let total = 0;
      parts.forEach(part => {
        if (part.includes('/')) {
          const [num, den] = part.split('/').map(Number);
          total += num / den;
        } else {
          total += Number(part);
        }
      });
      quantity = total;
    } else {
      quantity = Number(qtyStr);
    }
    remainingText = text.slice(quantityMatch[0].length).trim();
  }
  
  // Extract unit (common units after quantity)
  let unit: string | null = null;
  const unitPattern = /\b(tbsp|tbs|tablespoon|tablespoons|tsp|teaspoon|teaspoons|cup|cups|c|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters|each|piece|pieces|item|items|can|cans|package|packages)\b/i;
  const unitMatch = remainingText.match(unitPattern);
  if (unitMatch) {
    unit = normalizeUnit(unitMatch[1]);
    remainingText = remainingText.replace(unitMatch[0], '').trim();
  }
  
  // Extract modifiers
  const modifiers = extractModifiers(remainingText);
  
  // Extract name (everything else, cleaned up)
  let name = remainingText;
  // Remove common prefixes like "of", "a", "an"
  name = name.replace(/^(of|a|an)\s+/i, '').trim();
  // Remove parenthetical notes like "(14 oz)" - keep in notes if needed
  name = name.replace(/\([^)]+\)/g, '').trim();
  
  // Check if optional (contains "optional" or "to taste")
  const optional = /optional|to taste/i.test(text);
  
  // Get canonical name
  const canonicalName = getCanonicalName(name);
  
  // Confidence score (simplified - can be enhanced)
  let confidence = 0.8; // default
  if (!quantity && !unit) confidence = 0.5; // unclear quantity
  if (name.length < 2) confidence = 0.3; // very short name
  if (optional) confidence = 0.6; // optional items less certain
  
  return {
    name: canonicalName,
    quantity,
    unit,
    modifiers,
    optional,
    confidence,
  };
}

/**
 * Generate canonical key for an ingredient
 */
export function generateCanonicalKey(parsed: IngredientLine['parsed']): string {
  if (!parsed) {
    throw new Error('Cannot generate canonical key: parsed ingredient is required');
  }
  const baseKey = normalizeToCanonicalKey(parsed.name);
  return baseKey;
}
