// Import the mapping data from TypeScript file
import { ingredientMapping } from '../data/ingredientMapping';

// Reverse mapping: ingredient name -> sprite code
const reverseMapping: Record<string, string> = {};

// Build reverse mapping from the JSON
Object.entries(ingredientMapping).forEach(([code, name]) => {
  reverseMapping[name as string] = code;
});

// Also create aliases for common variations
const aliases: Record<string, string> = {
  // Shrimp variations
  'shrimp': 'A1',
  'prawn': 'A1',
  'prawns': 'A1',
  
  // Lemon variations
  'lemon': 'A2',
  'lemon slice': 'A2',
  'lemon_slice': 'A2',
  'lime': 'A2',
  
  // Chicken variations
  'chicken': 'A3',
  'drumstick': 'A3',
  'chicken drumstick': 'A3',
  
  // Steak variations
  'steak': 'A6',
  'beef': 'A6',
  
  // Tomato variations
  'tomato': 'B5',
  'tomato_half': 'B5',
  'tomatoes': 'B5',
  'cherry tomatoes': 'A7',
  'cherry_tomatoes_cluster': 'A7',
  
  // Onion variations
  'onion': 'B3',
  'onion_half': 'B3',
  'onions': 'B3',
  
  // Garlic variations
  'garlic': 'B2',
  'garlic_bulb': 'B2',
  'garlic clove': 'B2',
  
  // Carrot variations
  'carrot': 'B4',
  'carrot_whole': 'B4',
  'carrots': 'B4',
  
  // Bell pepper variations
  'bell pepper': 'B6',
  'bell_pepper_slice': 'B6',
  'bell_pepper_ring': '16',
  'pepper': 'B6',
  'peppers': 'B6',
  
  // Mushroom variations
  'mushroom': 'B9',
  'mushroom_cap': 'B9',
  'mushrooms': 'B9',
  
  // Broccoli variations
  'broccoli': '10',
  'broccoli_head': '10',
  
  // Potato variations
  'potato': 'B1',
  'potato_whole': 'B1',
  'whole_potato': '17',
  'potatoes': 'B1',
  'potato wedge': '18',
  'potato_wedge': '18',
  
  // Pasta variations
  'pasta': '20',
  'spaghetti': '20',
  'spaghetti_nest': '20',
  'noodles': '20',
  
  // Olive variations
  'olive': '29',
  'olives': '29',
  
  // Basil/Herb variations
  'basil': '21',
  'basil_leaf': '21',
  'herbs': '21',
  'herb': '21',
  
  // Cheese variations
  'cheese': '22',
  'cheese_wedge': '22',
  
  // Butter variations
  'butter': 'E1',
  'butter_pat': 'E1',
  
  // Salt variations
  'salt': 'E2',
  'salt_sprinkle': 'E2',
  
  // Oil variations
  'oil': 'E7',
  'oil_drop': 'E7',
  'olive oil': 'E7',
};

/**
 * Get sprite code for an ingredient name
 */
export const getIngredientSpriteCode = (ingredientName: string): string => {
  const nameLower = ingredientName.toLowerCase().trim();
  
  // Check aliases first
  if (aliases[nameLower]) {
    return aliases[nameLower];
  }
  
  // Check reverse mapping
  if (reverseMapping[nameLower]) {
    return reverseMapping[nameLower];
  }
  
  // Try partial matches
  for (const [key, code] of Object.entries(aliases)) {
    if (nameLower.includes(key) || key.includes(nameLower)) {
      return code;
    }
  }
  
  // Default fallback
  return 'A1'; // Shrimp as default
};

/**
 * Get all available sprite codes
 */
export const getAllSpriteCodes = (): string[] => {
  return Object.keys(ingredientMapping);
};

