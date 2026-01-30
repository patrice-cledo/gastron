/**
 * App-wide constants
 */

export const APP_NAME = 'Gastrons';
export const APP_VERSION = '1.0.0';

// API endpoints (to be configured)
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:3000/api' 
  : 'https://api.cookthispage.com';

// Storage keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: '@cookthispage:user_preferences',
  RECIPES: '@cookthispage:recipes',
  FAVORITES: '@cookthispage:favorites',
} as const;

// Recipe limits
export const MAX_RECIPE_TITLE_LENGTH = 100;
export const MAX_INGREDIENTS = 50;
export const MAX_STEPS = 30;

