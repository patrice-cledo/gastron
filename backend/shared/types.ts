/**
 * Shared TypeScript types for backend and client
 * These types are used across Cloud Functions and can be imported by the mobile app
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface IngredientLine {
  id: string;
  rawText: string;
  parsed?: {
    name: string; // canonical candidate
    quantity: number | null;
    unit: string | null;
    modifiers: string[]; // diced, chopped, etc.
    optional: boolean;
    confidence: number; // 0..1
  };
}

// Recipe ingredient (for user-created recipes)
export interface RecipeIngredient {
  id: string;
  name: string;
  amount: string; // e.g., "2", "1/2"
  unit?: string; // e.g., "cups", "tbsp"
}

// Recipe step/instruction
export interface RecipeStep {
  id: string;
  order: number;
  description: string;
  image?: string; // URL to step image
  duration?: number; // in minutes
}

// Nutrition information (per serving)
export interface RecipeNutrition {
  calories: number;
  protein: number; // in grams
  carbs: number; // in grams
  fats: number; // in grams
}

// Equipment needed for recipe
export interface RecipeEquipment {
  id: string;
  name: string;
  description?: string;
  image?: string; // URL to equipment image
}

// Recipe type for meal planning (uses IngredientLine with parsed data)
// This is used by the grocery list engine
export interface Recipe {
  id: string;
  title: string;
  servingsDefault: number;
  ingredients: IngredientLine[];
  instructions: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string; // if user-created
}

// User-created recipe type (simpler format, stored in Firestore)
// This is what users create manually
export interface UserRecipe {
  id: string;
  title: string;
  description?: string;
  notes?: string; // Additional notes about the recipe
  chefTips?: string[]; // Array of chef tips/hints
  image?: string; // URL to recipe image
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  equipment?: RecipeEquipment[]; // Optional equipment list
  prepTime?: number; // in minutes
  cookTime?: number; // in minutes
  servings?: number;
  nutrition?: RecipeNutrition;
  tags?: string[]; // Tags for categorization/search
  cuisine?: string;
  sourceUrls?: string[]; // URLs where recipe came from
  collections?: string[]; // Array of collection/cookbook names (e.g., ["Favorites", "Want to cook", "One-Pot"])
  userId: string; // Required for user-created recipes
  isPublic: boolean; // false = private (default), true = public
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

export interface MealPlanEntry {
  id: string;
  planId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  recipeId: string;
  servingsOverride: number | null;
  includeInGrocery: boolean;
  notes?: string;
  batchCook?: boolean; // optional marker for batch cooking
}

export interface MealPlan {
  id: string;
  userId: string;
  startDate: string; // YYYY-MM-DD (week start)
  entries: MealPlanEntry[];
  createdAt?: Date;
  updatedAt?: Date;
  version?: number; // for sync
}

export interface GrocerySource {
  recipeId: string;
  mealPlanEntryId: string;
  ingredientLineId: string;
  amount: {
    quantity: number | null;
    unit: string | null;
  };
}

export interface GroceryItem {
  id: string;
  canonicalKey: string; // the dedupe key
  displayName: string;
  quantity: number | null;
  unit: string | null;
  categoryId: string;
  checked: boolean;
  pinned: boolean; // manual or locked
  notes?: string | null;
  sources: GrocerySource[];
  suppressed?: boolean; // if user manually deleted auto item
}

export interface GroceryList {
  id: string;
  userId: string;
  scope: {
    dateRangeStart: string; // YYYY-MM-DD
    dateRangeEnd: string; // YYYY-MM-DD
  };
  items: GroceryItem[];
  version: number; // for sync
  computedAt?: Date;
  updatedAt?: Date;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  userCustom: boolean;
}

export interface UserOverrides {
  userId: string;
  ingredientCanonicalMap: Record<string, string>; // rawName -> canonicalKey
  categoryMap: Record<string, string>; // canonicalKey -> categoryId
  updatedAt?: Date;
}

// Default categories
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Produce', sortOrder: 1, userCustom: false },
  { name: 'Dairy', sortOrder: 2, userCustom: false },
  { name: 'Meat', sortOrder: 3, userCustom: false },
  { name: 'Pantry', sortOrder: 4, userCustom: false },
  { name: 'Spices', sortOrder: 5, userCustom: false },
  { name: 'Frozen', sortOrder: 6, userCustom: false },
  { name: 'Bakery', sortOrder: 7, userCustom: false },
  { name: 'Beverages', sortOrder: 8, userCustom: false },
  { name: 'Other', sortOrder: 9, userCustom: false },
];

// Recipe Import Types
export type ImportStatus = 'queued' | 'fetching' | 'extracting' | 'ocr' | 'ready' | 'failed';
export type ParserType = 'jsonld' | 'microdata' | 'heuristic' | 'text' | 'vision_ocr+heuristic';
export type ErrorCode = 
  | 'FETCH_FAILED'
  | 'BLOCKED_DOMAIN'
  | 'PAYWALL_OR_LOGIN'
  | 'NO_RECIPE_FOUND'
  | 'PARSING_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INVALID_URL'
  | 'SSRF_BLOCKED'
  | 'IMAGE_TOO_LARGE'
  | 'OCR_NO_TEXT'
  | 'OCR_FAILED';

export interface ImportJob {
  id: string;
  userId: string;
  sourceUrl?: string; // For URL imports
  source?: 'url' | 'photo'; // Import source type
  storagePath?: string; // For photo imports: "imports/uid_123/imp_abc.jpg"
  status: ImportStatus;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
  errorCode?: ErrorCode | null;
  errorMessage?: string | null;
  result?: {
    recipeDraftId: string;
    confidence: number; // 0..1
    parser: ParserType;
    warnings: string[];
  } | null;
  metrics?: {
    fetchMs?: number;
    extractMs?: number;
    ocrMs?: number;
    contentBytes?: number;
    imageBytes?: number;
  } | null;
}

export interface RecipeDraft {
  id: string;
  userId: string;
  sourceUrl?: string; // For URL imports
  source?: 'url' | 'photo' | 'text'; // Import source type
  importId?: string; // Reference to import job
  imageStoragePath?: string; // For photo imports: "imports/uid_123/imp_abc.jpg"
  title: string;
  imageUrl?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  ingredients: Array<{
    raw: string;
    name?: string;
    quantity?: number | null;
    unit?: string | null;
    notes?: string;
  }>;
  instructions: Array<{
    step: number;
    text: string;
  }>;
  tags?: string[];
  description?: string; // Recipe description from source (e.g., "This easy Buffalo chicken dip recipe...")
  notes?: string; // Additional notes from source
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  confidence: number; // 0..1
  parser: ParserType;
  warnings?: string[];
  ocrText?: string | null; // Raw OCR text (optional, for debugging)
  createdAt: number; // timestamp
}

// OTP Authentication Types
export type OtpChallengeStatus = 'pending' | 'verified' | 'expired' | 'failed_delivery';

export interface OtpChallenge {
  id: string;
  email: string;
  otpHash: string; // Hashed OTP, never plaintext
  salt: string; // Salt used for hashing (needed for verification)
  expiresAt: number; // timestamp
  status: OtpChallengeStatus;
  attempts: number; // Verification attempts
  maxAttempts: number; // Usually 3
  createdAt: number; // timestamp
  verifiedAt?: number; // timestamp when verified
  ipHash?: string; // Hashed IP for rate limiting (optional)
}

// Recipe Review/Rating
export interface RecipeReview {
  id: string;
  recipeId: string;
  userId: string;
  rating: number; // 1-5
  comments?: string;
  imageUrl?: string;
  userName?: string;
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}

// Firestore document paths (for type safety)
export const COLLECTIONS = {
  users: 'users',
  recipes: 'recipes',
  mealPlans: 'mealPlans',
  mealPlanEntries: 'mealPlanEntries',
  groceryLists: 'groceryLists',
  groceryItems: 'groceryItems',
  userOverrides: 'userOverrides',
  categories: 'categories',
  imports: 'imports',
  recipeDrafts: 'recipeDrafts',
  otpChallenges: 'otpChallenges',
  reviews: 'reviews',
} as const;
