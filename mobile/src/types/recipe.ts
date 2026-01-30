export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit?: string;
  icon?: string;
}

export interface Step {
  id: string;
  order: number;
  description: string;
  image?: string;
  duration?: number; // in minutes
}

export interface Nutrition {
  calories: number;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
}

export interface RecipeEquipment {
  id?: string;
  name: string;
  image?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  image?: string | any; // Can be URI string or require() result
  ingredients: Ingredient[];
  steps: Step[];
  equipment?: RecipeEquipment[]; // Equipment list
  prepTime?: number; // in minutes
  cookTime?: number; // in minutes
  servings?: number;
  nutrition?: Nutrition; // per serving
  tags?: string[]; // Tags for categorization/search
  collections?: string[]; // Array of collection/cookbook names (e.g., ["Favorites", "Want to cook", "One-Pot"])
  userId?: string; // Firebase Auth user ID
  createdAt: string;
  updatedAt: string;
}

