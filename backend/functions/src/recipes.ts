/**
 * Recipe Management Cloud Functions
 * 
 * Functions:
 * - createRecipe: Create a new recipe (private by default)
 * - updateRecipe: Update an existing recipe (including public/private toggle)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  UserRecipe,
  RecipeIngredient,
  RecipeStep,
  RecipeEquipment,
  RecipeNutrition,
  COLLECTIONS,
} from '../../shared/types';

const db = admin.firestore();

/**
 * Parse time duration from instruction text
 * Looks for patterns like "for 30 minutes", "30 min", "for 1 hour", etc.
 * Returns duration in minutes, or undefined if no time found
 */
function parseDurationFromText(text: string): number | undefined {
  if (!text || typeof text !== 'string') {
    console.log('[parseDurationFromText] Invalid input:', text);
    return undefined;
  }

  const normalizedText = text.toLowerCase().trim();
  console.log('[parseDurationFromText] Parsing text:', normalizedText);

  // Patterns to match (in order of priority):
  // 1. "for X minutes/min" - most common pattern
  // 2. "for X hours/hr/h" 
  // 3. "X minutes/min" (standalone)
  // 4. "X hours/hr/h" (standalone)
  
  const patterns = [
    // "for X minutes" or "for X min" - highest priority, most common
    { pattern: /for\s+(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|minute|min)\b/i, isHours: false, name: 'for-X-minutes' },
    // "for X hours" or "for X hour" or "for X hr" or "for X hrs" or "for X h"
    { pattern: /for\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hour|hr)\b/i, isHours: true, name: 'for-X-hours' },
    // "X minutes" or "X min" (standalone, but not part of another word like "350F")
    // Use word boundary before number to avoid matching "350F" as "350"
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|minute|min)\b/i, isHours: false, name: 'X-minutes' },
    // "X hours" or "X hour" or "X hr" or "X hrs" (standalone)
    { pattern: /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hour|hr)\b/i, isHours: true, name: 'X-hours' },
  ];

  // Check patterns in order of priority
  for (const { pattern, isHours, name } of patterns) {
    const match = normalizedText.match(pattern);
    console.log(`[parseDurationFromText] Testing pattern "${name}":`, pattern.toString(), 'Match result:', match);
    if (match && match[1]) {
      const value = parseFloat(match[1].replace(/\s+/g, ''));
      console.log(`[parseDurationFromText] Extracted value:`, value, 'isHours:', isHours);
      if (!isNaN(value) && value > 0) {
        const duration = isHours ? Math.round(value * 60) : Math.round(value);
        console.log('[parseDurationFromText] ✓ SUCCESS - Found duration:', duration, 'minutes from pattern:', name, 'in text:', normalizedText);
        return duration;
      }
    }
  }

  console.log('[parseDurationFromText] ✗ No duration found in text:', normalizedText);
  return undefined;
}

/**
 * Process steps to automatically extract duration from text if not already set
 */
function processStepsWithAutoDuration(steps: RecipeStep[]): RecipeStep[] {
  console.log('[processStepsWithAutoDuration] ===== START Processing', steps.length, 'steps =====');
  const result = steps.map((step, index) => {
    console.log(`[processStepsWithAutoDuration] Step ${index + 1}:`, {
      id: step.id,
      description: step.description,
      currentDuration: step.duration,
    });
    
    // If duration is already set, don't override it
    if (step.duration !== undefined && step.duration !== null) {
      console.log(`[processStepsWithAutoDuration] Step ${index + 1} already has duration:`, step.duration);
      return step;
    }

    // Try to parse duration from description
    const parsedDuration = parseDurationFromText(step.description);
    if (parsedDuration !== undefined) {
      const updatedStep = {
        ...step,
        duration: parsedDuration,
      };
      console.log(`[processStepsWithAutoDuration] ✓ Step ${index + 1} UPDATED with duration:`, parsedDuration, 'minutes');
      console.log(`[processStepsWithAutoDuration] Updated step object:`, JSON.stringify(updatedStep, null, 2));
      return updatedStep;
    }

    console.log(`[processStepsWithAutoDuration] Step ${index + 1} no duration found`);
    return step;
  });
  
  console.log('[processStepsWithAutoDuration] ===== END Processing =====');
  console.log('[processStepsWithAutoDuration] Final result:', JSON.stringify(result, null, 2));
  return result;
}

interface CreateRecipeRequest {
  title: string;
  description?: string;
  notes?: string;
  chefTips?: string[];
  image?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  equipment?: RecipeEquipment[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  nutrition?: RecipeNutrition;
  tags?: string[];
  cuisine?: string;
  sourceUrls?: string[];
  collections?: string[]; // Array of collection/cookbook names
  isPublic?: boolean; // Optional, defaults to false
}

interface UpdateRecipeRequest {
  recipeId: string;
  title?: string;
  description?: string;
  notes?: string;
  chefTips?: string[];
  image?: string;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  equipment?: RecipeEquipment[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  nutrition?: RecipeNutrition;
  tags?: string[];
  cuisine?: string;
  sourceUrls?: string[];
  collections?: string[]; // Array of collection/cookbook names
  isPublic?: boolean; // Can toggle public/private
}

/**
 * Create a new recipe
 * 
 * Recipes are private by default unless isPublic is explicitly set to true
 */
export const createRecipe = onCall(
  { enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const data = request.data as CreateRecipeRequest;

    // Validate required fields
    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'Recipe title is required');
    }

    if (!data.ingredients || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one ingredient is required');
    }

    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      throw new HttpsError('invalid-argument', 'At least one instruction step is required');
    }

    // Validate ingredients
    for (const ingredient of data.ingredients) {
      if (!ingredient.id || !ingredient.name || typeof ingredient.name !== 'string') {
        throw new HttpsError('invalid-argument', 'Invalid ingredient format');
      }
    }

    // Validate steps
    for (const step of data.steps) {
      if (!step.id || !step.description || typeof step.description !== 'string' || typeof step.order !== 'number') {
        throw new HttpsError('invalid-argument', 'Invalid step format');
      }
    }

    // Validate equipment if provided
    if (data.equipment) {
      for (const item of data.equipment) {
        if (!item.id || !item.name || typeof item.name !== 'string') {
          throw new HttpsError('invalid-argument', 'Invalid equipment format');
        }
      }
    }

    // Validate nutrition if provided
    if (data.nutrition) {
      const { calories, protein, carbs, fats } = data.nutrition;
      if (
        typeof calories !== 'number' || calories < 0 ||
        typeof protein !== 'number' || protein < 0 ||
        typeof carbs !== 'number' || carbs < 0 ||
        typeof fats !== 'number' || fats < 0
      ) {
        throw new HttpsError('invalid-argument', 'Invalid nutrition values');
      }
    }

    // Validate times
    if (data.prepTime !== undefined && (typeof data.prepTime !== 'number' || data.prepTime < 0)) {
      throw new HttpsError('invalid-argument', 'prepTime must be a non-negative number');
    }

    if (data.cookTime !== undefined && (typeof data.cookTime !== 'number' || data.cookTime < 0)) {
      throw new HttpsError('invalid-argument', 'cookTime must be a non-negative number');
    }

    if (data.servings !== undefined && (typeof data.servings !== 'number' || data.servings <= 0)) {
      throw new HttpsError('invalid-argument', 'servings must be a positive number');
    }

    // Validate image URL if provided
    if (data.image && typeof data.image === 'string') {
      try {
        const url = new URL(data.image);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new HttpsError('invalid-argument', 'Image URL must be http or https');
        }
      } catch {
        throw new HttpsError('invalid-argument', 'Invalid image URL format');
      }
    }

    // Validate source URLs if provided
    if (data.sourceUrls) {
      for (const url of data.sourceUrls) {
        if (typeof url !== 'string') {
          throw new HttpsError('invalid-argument', 'All source URLs must be strings');
        }
        try {
          const urlObj = new URL(url);
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new HttpsError('invalid-argument', 'Source URLs must be http or https');
          }
        } catch {
          throw new HttpsError('invalid-argument', 'Invalid source URL format');
        }
      }
    }

    // Validate chef tips if provided
    if (data.chefTips !== undefined) {
      if (!Array.isArray(data.chefTips)) {
        throw new HttpsError('invalid-argument', 'chefTips must be an array');
      }
      for (const tip of data.chefTips) {
        if (typeof tip !== 'string') {
          throw new HttpsError('invalid-argument', 'All chef tips must be strings');
        }
      }
    }

    // Validate tags if provided
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        throw new HttpsError('invalid-argument', 'tags must be an array');
      }
      for (const tag of data.tags) {
        if (typeof tag !== 'string') {
          throw new HttpsError('invalid-argument', 'All tags must be strings');
        }
      }
    }

    try {
      const now = Date.now();
      
      // Process steps to auto-detect duration from text
      console.log('[createRecipe] Before processing steps:', JSON.stringify(data.steps, null, 2));
      const processedSteps = processStepsWithAutoDuration(data.steps);
      console.log('[createRecipe] After processing steps:', JSON.stringify(processedSteps, null, 2));
      
      // Create recipe document
      const recipeRef = db.collection(COLLECTIONS.recipes).doc();
      const recipeId = recipeRef.id;

      // Build recipe object, only including defined fields (omit undefined)
      const sortedSteps = processedSteps.sort((a, b) => a.order - b.order);
      console.log('[createRecipe] Steps to save (after sort):', JSON.stringify(sortedSteps, null, 2));
      console.log('[createRecipe] Checking for duration fields in steps:');
      sortedSteps.forEach((step, idx) => {
        const hasDuration = step.duration !== undefined && step.duration !== null;
        console.log(`  Step ${idx + 1} (order ${step.order}): duration = ${hasDuration ? step.duration : 'UNDEFINED'}, description = "${step.description}"`);
        if (!hasDuration && step.description) {
          // Double-check: try parsing again
          const testParse = parseDurationFromText(step.description);
          if (testParse !== undefined) {
            console.log(`  ⚠️ WARNING: Step ${idx + 1} should have duration ${testParse} but doesn't!`);
          }
        }
      });
      
      // Ensure all steps have the correct structure (including duration if extracted)
      const finalSteps = sortedSteps.map(step => {
        const stepObj: any = {
          id: step.id,
          order: step.order,
          description: step.description,
        };
        if (step.image) {
          stepObj.image = step.image;
        }
        if (step.duration !== undefined && step.duration !== null) {
          stepObj.duration = step.duration;
        }
        return stepObj;
      });
      
      console.log('[createRecipe] Final steps structure:', JSON.stringify(finalSteps, null, 2));
      
      const recipe: any = {
        id: recipeId,
        title: data.title.trim(),
        ingredients: data.ingredients,
        steps: finalSteps, // Ensure steps are sorted by order and have correct structure
        userId,
        isPublic: data.isPublic === true, // Default to false (private)
        createdAt: now,
        updatedAt: now,
      };

      // Only add optional fields if they are defined and have values
      if (data.description?.trim()) {
        recipe.description = data.description.trim();
      }
      if (data.notes?.trim()) {
        recipe.notes = data.notes.trim();
      }
      if (data.chefTips && data.chefTips.length > 0) {
        const filteredTips = data.chefTips.filter(tip => tip.trim().length > 0).map(tip => tip.trim());
        if (filteredTips.length > 0) {
          recipe.chefTips = filteredTips;
        }
      }
      if (data.image) {
        recipe.image = data.image;
      }
      if (data.equipment && data.equipment.length > 0) {
        recipe.equipment = data.equipment;
      }
      if (data.prepTime) {
        recipe.prepTime = data.prepTime;
      }
      if (data.cookTime) {
        recipe.cookTime = data.cookTime;
      }
      if (data.servings) {
        recipe.servings = data.servings;
      }
      if (data.nutrition) {
        recipe.nutrition = data.nutrition;
      }
      if (data.tags && data.tags.length > 0) {
        const filteredTags = data.tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim());
        if (filteredTags.length > 0) {
          recipe.tags = filteredTags;
        }
      }
      if (data.cuisine) {
        recipe.cuisine = data.cuisine;
      }
      if (data.sourceUrls && data.sourceUrls.length > 0) {
        recipe.sourceUrls = data.sourceUrls;
      }
      if (data.collections && Array.isArray(data.collections) && data.collections.length > 0) {
        // Filter out empty strings and 'Uncategorized', then trim
        const validCollections = data.collections
          .filter((col: string) => col && typeof col === 'string' && col.trim() && col.trim() !== 'Uncategorized')
          .map((col: string) => col.trim());
        if (validCollections.length > 0) {
          recipe.collections = validCollections;
        }
      }

      console.log('[createRecipe] Final recipe object to save:', JSON.stringify(recipe, null, 2));
      console.log('[createRecipe] Steps in final recipe:', JSON.stringify(recipe.steps, null, 2));
      
      await recipeRef.set(recipe);

      console.log(`Recipe created: ${recipeId} by user ${userId} (${recipe.isPublic ? 'public' : 'private'})`);

      return {
        recipeId,
        recipe,
      };
    } catch (error: any) {
      console.error('Error creating recipe:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'Failed to create recipe');
    }
  }
);

/**
 * Update an existing recipe
 * 
 * Only the recipe owner can update their recipe
 * Can toggle public/private status
 */
export const updateRecipe = onCall(
  { enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const data = request.data as UpdateRecipeRequest;

    // Validate required fields
    if (!data.recipeId || typeof data.recipeId !== 'string') {
      throw new HttpsError('invalid-argument', 'recipeId is required');
    }

    // Get existing recipe
    const recipeRef = db.collection(COLLECTIONS.recipes).doc(data.recipeId);
    const recipeDoc = await recipeRef.get();

    if (!recipeDoc.exists) {
      throw new HttpsError('not-found', 'Recipe not found');
    }

      const existingRecipe = recipeDoc.data() as UserRecipe;

    // Verify ownership
    if (existingRecipe.userId !== userId) {
      throw new HttpsError('permission-denied', 'You can only update your own recipes');
    }

    // Validate updates (similar to create)
    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'Recipe title cannot be empty');
      }
    }

    if (data.ingredients !== undefined) {
      if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one ingredient is required');
      }
      for (const ingredient of data.ingredients) {
        if (!ingredient.id || !ingredient.name || typeof ingredient.name !== 'string') {
          throw new HttpsError('invalid-argument', 'Invalid ingredient format');
        }
      }
    }

    if (data.steps !== undefined) {
      if (!Array.isArray(data.steps) || data.steps.length === 0) {
        throw new HttpsError('invalid-argument', 'At least one instruction step is required');
      }
      for (const step of data.steps) {
        if (!step.id || !step.description || typeof step.description !== 'string' || typeof step.order !== 'number') {
          throw new HttpsError('invalid-argument', 'Invalid step format');
        }
      }
    }

    if (data.equipment !== undefined) {
      for (const item of data.equipment) {
        if (!item.id || !item.name || typeof item.name !== 'string') {
          throw new HttpsError('invalid-argument', 'Invalid equipment format');
        }
      }
    }

    if (data.nutrition !== undefined) {
      const { calories, protein, carbs, fats } = data.nutrition;
      if (
        typeof calories !== 'number' || calories < 0 ||
        typeof protein !== 'number' || protein < 0 ||
        typeof carbs !== 'number' || carbs < 0 ||
        typeof fats !== 'number' || fats < 0
      ) {
        throw new HttpsError('invalid-argument', 'Invalid nutrition values');
      }
    }

    if (data.prepTime !== undefined && (typeof data.prepTime !== 'number' || data.prepTime < 0)) {
      throw new HttpsError('invalid-argument', 'prepTime must be a non-negative number');
    }

    if (data.cookTime !== undefined && (typeof data.cookTime !== 'number' || data.cookTime < 0)) {
      throw new HttpsError('invalid-argument', 'cookTime must be a non-negative number');
    }

    if (data.servings !== undefined && (typeof data.servings !== 'number' || data.servings <= 0)) {
      throw new HttpsError('invalid-argument', 'servings must be a positive number');
    }

    if (data.image !== undefined && data.image !== null) {
      if (typeof data.image !== 'string') {
        throw new HttpsError('invalid-argument', 'Image must be a URL string or null');
      }
      if (data.image) {
        try {
          const url = new URL(data.image);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new HttpsError('invalid-argument', 'Image URL must be http or https');
          }
        } catch {
          throw new HttpsError('invalid-argument', 'Invalid image URL format');
        }
      }
    }

    if (data.sourceUrls !== undefined) {
      for (const url of data.sourceUrls) {
        if (typeof url !== 'string') {
          throw new HttpsError('invalid-argument', 'All source URLs must be strings');
        }
        try {
          const urlObj = new URL(url);
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new HttpsError('invalid-argument', 'Source URLs must be http or https');
          }
        } catch {
          throw new HttpsError('invalid-argument', 'Invalid source URL format');
        }
      }
    }

    // Validate chef tips if provided
    if (data.chefTips !== undefined) {
      if (!Array.isArray(data.chefTips)) {
        throw new HttpsError('invalid-argument', 'chefTips must be an array');
      }
      for (const tip of data.chefTips) {
        if (typeof tip !== 'string') {
          throw new HttpsError('invalid-argument', 'All chef tips must be strings');
        }
      }
    }

    // Validate tags if provided
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        throw new HttpsError('invalid-argument', 'tags must be an array');
      }
      for (const tag of data.tags) {
        if (typeof tag !== 'string') {
          throw new HttpsError('invalid-argument', 'All tags must be strings');
        }
      }
    }

    try {
      const now = Date.now();
      
      // Build update object (only include fields that are being updated)
      const updates: Partial<UserRecipe> & { updatedAt: number } = {
        updatedAt: now,
      };

      if (data.title !== undefined) {
        updates.title = data.title.trim();
      }
      if (data.description !== undefined) {
        updates.description = data.description?.trim() || undefined;
      }
      if (data.notes !== undefined) {
        updates.notes = data.notes?.trim() || undefined;
      }
      if (data.chefTips !== undefined) {
        updates.chefTips = data.chefTips.length > 0
          ? data.chefTips.filter(tip => tip.trim().length > 0).map(tip => tip.trim())
          : undefined;
      }
      if (data.image !== undefined) {
        updates.image = data.image || undefined;
      }
      if (data.ingredients !== undefined) {
        updates.ingredients = data.ingredients;
      }
      if (data.steps !== undefined) {
        // Process steps to auto-detect duration from text
        console.log('[updateRecipe] Before processing steps:', JSON.stringify(data.steps, null, 2));
        const processedSteps = processStepsWithAutoDuration(data.steps);
        console.log('[updateRecipe] After processing steps:', JSON.stringify(processedSteps, null, 2));
        const sortedSteps = processedSteps.sort((a, b) => a.order - b.order);
        
        // Ensure all steps have the correct structure (including duration if extracted)
        const finalSteps = sortedSteps.map(step => {
          const stepObj: any = {
            id: step.id,
            order: step.order,
            description: step.description,
          };
          if (step.image) {
            stepObj.image = step.image;
          }
          if (step.duration !== undefined && step.duration !== null) {
            stepObj.duration = step.duration;
          }
          return stepObj;
        });
        
        console.log('[updateRecipe] Final steps structure:', JSON.stringify(finalSteps, null, 2));
        console.log('[updateRecipe] Checking for duration fields in steps:');
        finalSteps.forEach((step, idx) => {
          const hasDuration = step.duration !== undefined && step.duration !== null;
          console.log(`  Step ${idx + 1} (order ${step.order}): duration = ${hasDuration ? step.duration : 'UNDEFINED'}, description = "${step.description}"`);
        });
        
        updates.steps = finalSteps;
        console.log('[updateRecipe] Steps to save to Firestore:', JSON.stringify(updates.steps, null, 2));
      }
      if (data.equipment !== undefined) {
        updates.equipment = data.equipment.length > 0 ? data.equipment : undefined;
      }
      if (data.prepTime !== undefined) {
        updates.prepTime = data.prepTime || undefined;
      }
      if (data.cookTime !== undefined) {
        updates.cookTime = data.cookTime || undefined;
      }
      if (data.servings !== undefined) {
        updates.servings = data.servings || undefined;
      }
      if (data.nutrition !== undefined) {
        updates.nutrition = data.nutrition || undefined;
      }
      if (data.tags !== undefined) {
        updates.tags = data.tags && data.tags.length > 0
          ? data.tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim())
          : undefined;
      }
      if (data.cuisine !== undefined) {
        updates.cuisine = data.cuisine || undefined;
      }
      if (data.sourceUrls !== undefined) {
        updates.sourceUrls = data.sourceUrls && data.sourceUrls.length > 0 ? data.sourceUrls : undefined;
      }
      if (data.collections !== undefined) {
        if (Array.isArray(data.collections) && data.collections.length > 0) {
          // Filter out empty strings and 'Uncategorized', then trim
          const validCollections = data.collections
            .filter((col: string) => col && typeof col === 'string' && col.trim() && col.trim() !== 'Uncategorized')
            .map((col: string) => col.trim());
          if (validCollections.length > 0) {
            updates.collections = validCollections;
          } else {
            // Remove collections field if all are invalid
            updates.collections = admin.firestore.FieldValue.delete() as any;
          }
        } else {
          // Remove collections field if set to empty array or null
          updates.collections = admin.firestore.FieldValue.delete() as any;
        }
      }
      if (data.isPublic !== undefined) {
        updates.isPublic = data.isPublic;
      }

      await recipeRef.update(updates);

      // Get updated recipe
      const updatedDoc = await recipeRef.get();
      const updatedRecipe = { id: updatedDoc.id, ...updatedDoc.data() } as UserRecipe;

      console.log(`Recipe updated: ${data.recipeId} by user ${userId} (${updatedRecipe.isPublic ? 'public' : 'private'})`);

      return {
        recipeId: data.recipeId,
        recipe: updatedRecipe,
      };
    } catch (error: any) {
      console.error('Error updating recipe:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'Failed to update recipe');
    }
  }
);

/**
 * Mark a recipe as started/cooked
 * 
 * This function is called when a user starts cooking a recipe.
 * It creates or updates a record in the userCookedRecipes collection.
 */
export const markRecipeAsCooked = onCall(async (request) => {
  const { recipeId } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  if (!recipeId || typeof recipeId !== 'string') {
    throw new HttpsError('invalid-argument', 'recipeId is required and must be a string');
  }

  try {
    const cookedDocRef = db.collection('userCookedRecipes').doc(`${userId}_${recipeId}`);
    
    // Use set with merge to create or update
    await cookedDocRef.set({
      userId: userId,
      recipeId: recipeId,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      cookedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`Recipe ${recipeId} marked as cooked by user ${userId}`);
    
    return {
      success: true,
      recipeId: recipeId,
    };
  } catch (error: any) {
    console.error('Error marking recipe as cooked:', error);
    throw new HttpsError('internal', error.message || 'Failed to mark recipe as cooked');
  }
});
