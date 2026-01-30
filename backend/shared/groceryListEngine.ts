/**
 * Grocery List Engine
 * 
 * Derives grocery lists from meal plans by:
 * - Aggregating ingredients from all recipes
 * - Applying ingredient normalization
 * - Deduplicating items
 * - Preserving user edits (checked, pinned, category overrides)
 */

import {
  MealPlan,
  GroceryList,
  GroceryItem,
  GrocerySource,
  Recipe,
  UserOverrides,
  Category,
} from './types';
import { parseIngredientLine, generateCanonicalKey, normalizeUnit } from './ingredientNormalizer';

export interface RecomputeOptions {
  mealPlan: MealPlan;
  recipes: Recipe[];
  existingList?: GroceryList;
  userOverrides?: UserOverrides;
  categories?: Category[];
  dateRangeStart: string;
  dateRangeEnd: string;
}

/**
 * Recompute grocery list from meal plan
 */
export function recomputeGroceryList(options: RecomputeOptions): GroceryList {
  const {
    mealPlan,
    recipes,
    existingList,
    userOverrides,
    categories = [],
    dateRangeStart,
    dateRangeEnd,
  } = options;

  // Build recipe map for quick lookup
  const recipeMap = new Map<string, Recipe>();
  recipes.forEach(recipe => {
    recipeMap.set(recipe.id, recipe);
  });

  // Build category map
  const categoryMap = new Map<string, Category>();
  categories.forEach(cat => {
    categoryMap.set(cat.id, cat);
  });

  // Get default category (usually "Other" or "Pantry")
  const defaultCategory = categories.find(c => c.name === 'Pantry') || categories[0];
  const defaultCategoryId = defaultCategory?.id || 'default';

  // Aggregate ingredients from all meal plan entries
  const ingredientMap = new Map<string, {
    canonicalKey: string;
    displayName: string;
    quantity: number | null;
    unit: string | null;
    sources: GrocerySource[];
    modifiers: string[];
    optional: boolean;
    confidence: number;
  }>();

  // Process each meal plan entry
  mealPlan.entries.forEach(entry => {
    if (!entry.includeInGrocery) return;

    const recipe = recipeMap.get(entry.recipeId);
    if (!recipe) return;

    const servingsMultiplier = entry.servingsOverride 
      ? entry.servingsOverride / recipe.servingsDefault
      : 1;

    // Process each ingredient in the recipe
    recipe.ingredients.forEach(ingredientLine => {
      // Use parsed data if available, otherwise parse raw text
      // parseIngredientLine always returns a parsed object, so parsed is never undefined
      const parsed = ingredientLine.parsed ?? parseIngredientLine(ingredientLine.rawText);
      
      // TypeScript doesn't know that parseIngredientLine always returns a value
      // but we know it does, so we assert it here
      if (!parsed) {
        console.warn(`Failed to parse ingredient: ${ingredientLine.rawText}`);
        return; // Skip this ingredient if parsing fails
      }
      
      // Apply user override for canonical key if exists
      let canonicalKey = generateCanonicalKey(parsed);
      if (userOverrides?.ingredientCanonicalMap[ingredientLine.rawText]) {
        canonicalKey = userOverrides.ingredientCanonicalMap[ingredientLine.rawText];
      }

      // Calculate scaled quantity
      let quantity: number | null = null;
      if (parsed.quantity !== null) {
        quantity = parsed.quantity * servingsMultiplier;
      }

      // Get or create ingredient entry
      const existing = ingredientMap.get(canonicalKey);
      
      if (existing) {
        // Merge with existing
        if (existing.quantity !== null && quantity !== null) {
          // Try to sum if units are compatible
          if (areUnitsCompatible(existing.unit, parsed.unit)) {
            existing.quantity += quantity;
          } else {
            // Incompatible units - keep separate but we'll handle this in the item
            // For now, sum quantities and note the unit conflict
            existing.quantity += quantity;
            // Mark with a note about unit conflict
            if (!existing.modifiers.includes('unit-conflict')) {
              existing.modifiers.push('unit-conflict');
            }
          }
        } else if (quantity !== null) {
          existing.quantity = quantity;
        }
        
        // Add source
        existing.sources.push({
          recipeId: recipe.id,
          mealPlanEntryId: entry.id,
          ingredientLineId: ingredientLine.id,
          amount: {
            quantity: parsed.quantity,
            unit: parsed.unit,
          },
        });
        
        // Merge modifiers
        parsed.modifiers.forEach(mod => {
          if (!existing.modifiers.includes(mod)) {
            existing.modifiers.push(mod);
          }
        });
        
        // Update confidence (take max)
        existing.confidence = Math.max(existing.confidence, parsed.confidence);
      } else {
        // Create new entry
        ingredientMap.set(canonicalKey, {
          canonicalKey,
          displayName: parsed.name,
          quantity,
          unit: normalizeUnit(parsed.unit),
          sources: [{
            recipeId: recipe.id,
            mealPlanEntryId: entry.id,
            ingredientLineId: ingredientLine.id,
            amount: {
              quantity: parsed.quantity,
              unit: parsed.unit,
            },
          }],
          modifiers: [...parsed.modifiers],
          optional: parsed.optional,
          confidence: parsed.confidence,
        });
      }
    });
  });

  // Convert to grocery items, preserving existing user edits
  const existingItemsMap = new Map<string, GroceryItem>();
  if (existingList) {
    existingList.items.forEach(item => {
      existingItemsMap.set(item.canonicalKey, item);
    });
  }

  const items: GroceryItem[] = [];
  ingredientMap.forEach((ingredient, canonicalKey) => {
    const existingItem = existingItemsMap.get(canonicalKey);
    
    // Check if item was suppressed by user
    if (existingItem?.suppressed) {
      return; // Skip this item
    }

    // Determine category
    let categoryId = defaultCategoryId;
    if (userOverrides?.categoryMap[canonicalKey]) {
      categoryId = userOverrides.categoryMap[canonicalKey];
    } else if (existingItem?.categoryId) {
      categoryId = existingItem.categoryId; // Preserve user's category override
    } else {
      // Auto-categorize based on ingredient name (simple heuristic)
      categoryId = autoCategorize(ingredient.displayName, categories, defaultCategoryId);
    }

    // Build notes from modifiers
    const notes = ingredient.modifiers.length > 0 
      ? ingredient.modifiers.filter(m => m !== 'unit-conflict').join(', ')
      : null;

    // Create or merge with existing item
    const item: GroceryItem = {
      id: existingItem?.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      canonicalKey,
      displayName: existingItem?.displayName || ingredient.displayName,
      quantity: existingItem?.pinned && existingItem.quantity !== null
        ? existingItem.quantity // Preserve pinned quantity
        : ingredient.quantity,
      unit: existingItem?.pinned && existingItem.unit
        ? existingItem.unit // Preserve pinned unit
        : ingredient.unit,
      categoryId,
      checked: existingItem?.checked || false, // Preserve checked state
      pinned: existingItem?.pinned || false, // Preserve pinned state
      notes: existingItem?.notes || notes, // Preserve user notes if exists
      sources: ingredient.sources,
      suppressed: false,
    };

    items.push(item);
  });

  // Add manually added items that aren't in the computed list
  if (existingList) {
    existingList.items.forEach(item => {
      if (item.pinned && !ingredientMap.has(item.canonicalKey)) {
        // This is a manually added item, keep it
        items.push(item);
      }
    });
  }

  // Sort items by category sortOrder, then by name
  items.sort((a, b) => {
    const catA = categoryMap.get(a.categoryId);
    const catB = categoryMap.get(b.categoryId);
    const sortOrderA = catA?.sortOrder || 999;
    const sortOrderB = catB?.sortOrder || 999;
    
    if (sortOrderA !== sortOrderB) {
      return sortOrderA - sortOrderB;
    }
    
    return a.displayName.localeCompare(b.displayName);
  });

  return {
    id: existingList?.id || `list_${Date.now()}`,
    userId: mealPlan.userId,
    scope: {
      dateRangeStart,
      dateRangeEnd,
    },
    items,
    version: (existingList?.version || 0) + 1,
    computedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Check if two units are compatible for merging
 */
function areUnitsCompatible(unit1: string | null, unit2: string | null): boolean {
  if (!unit1 || !unit2) return false;
  if (unit1 === unit2) return true;
  
  // Same type of units
  const weightUnits = ['gram', 'kilogram', 'ounce', 'pound'];
  const volumeUnits = ['milliliter', 'liter', 'cup', 'tablespoon', 'teaspoon'];
  const countUnits = ['each', 'piece', 'item'];
  
  const isWeight1 = weightUnits.includes(unit1);
  const isWeight2 = weightUnits.includes(unit2);
  const isVolume1 = volumeUnits.includes(unit1);
  const isVolume2 = volumeUnits.includes(unit2);
  const isCount1 = countUnits.includes(unit1);
  const isCount2 = countUnits.includes(unit2);
  
  return (isWeight1 && isWeight2) || (isVolume1 && isVolume2) || (isCount1 && isCount2);
}

/**
 * Auto-categorize ingredient based on name
 */
function autoCategorize(
  name: string,
  categories: Category[],
  defaultId: string
): string {
  const lowerName = name.toLowerCase();
  
  // Simple keyword-based categorization
  const categoryKeywords: Record<string, string[]> = {
    'Produce': ['onion', 'pepper', 'tomato', 'lettuce', 'spinach', 'carrot', 'celery', 'garlic', 'ginger', 'potato', 'apple', 'banana', 'orange', 'lemon', 'lime', 'avocado', 'cucumber', 'zucchini', 'broccoli', 'cauliflower'],
    'Dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream', 'cottage cheese'],
    'Meat': ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'bacon', 'sausage', 'ground'],
    'Pantry': ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'pasta', 'rice', 'beans', 'canned', 'tomato paste'],
    'Spices': ['paprika', 'cumin', 'coriander', 'turmeric', 'cinnamon', 'nutmeg', 'oregano', 'basil', 'thyme', 'rosemary', 'parsley'],
    'Frozen': ['frozen'],
    'Bakery': ['bread', 'roll', 'bagel', 'croissant'],
    'Beverages': ['juice', 'soda', 'water', 'wine', 'beer'],
  };
  
  for (const [categoryName, keywords] of Object.entries(categoryKeywords)) {
    const category = categories.find(c => c.name === categoryName);
    if (category && keywords.some(keyword => lowerName.includes(keyword))) {
      return category.id;
    }
  }
  
  return defaultId;
}
