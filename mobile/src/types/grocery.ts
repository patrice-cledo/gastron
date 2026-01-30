import { Ingredient } from './recipe';

export interface GrocerySource {
  recipeId: string;
  recipeTitle: string;
  mealPlanEntryId?: string;
  ingredientLineId?: string;
  amount?: string; // Normalized amount from this source
}

export interface GroceryItem {
  id: string;
  name: string;
  amount: string;
  unit?: string;
  icon?: string;
  checked: boolean;
  recipeId?: string; // Legacy: If added from a single recipe (for backward compatibility)
  recipeTitle?: string; // Legacy: Recipe title for reference
  category?: string; // Category like "FRESH PRODUCE", "DAIRY, EGGS & FRIDGE", etc.
  categoryOverride?: string; // User-overridden category
  notes?: string; // Optional notes (e.g., "divided", "chopped")
  pinned: boolean; // Manual item or locked (prevents deletion when plan changes)
  sources?: GrocerySource[]; // Array of recipes that contributed this item
  createdAt: string;
}

export interface GroceryRecipe {
  id: string;
  title: string;
  image?: string;
  ingredients: Ingredient[];
}

