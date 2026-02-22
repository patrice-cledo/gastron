/**
 * Cloud Functions for Gastrons
 *
 * Functions:
 * - recomputeGroceryList: Recomputes grocery list from meal plan
 * - normalizeIngredient: Normalizes a single ingredient line
 * - startRecipeImport: Starts recipe import from URL
 * - processRecipeImport: Background processing for recipe imports
 */

// Load environment variables from .env.local if it exists
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Try to load .env.local from the backend root directory
const envLocalPath = path.join(__dirname, "../../.env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({path: envLocalPath});
  console.log("✅ Loaded environment variables from .env.local");
}

// Initialize Firebase Admin FIRST, before any imports that use it
import * as admin from "firebase-admin";
if (!admin.apps.length) {
  // Always set emulator hosts for local development
  // The emulator automatically sets FUNCTIONS_EMULATOR, but we need to set these
  // BEFORE initializing Admin SDK
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
  }

  console.log("🔧 Firebase Admin SDK configuration:");
  console.log("  - FUNCTIONS_EMULATOR:", process.env.FUNCTIONS_EMULATOR || "not set");
  console.log("  - FIREBASE_AUTH_EMULATOR_HOST:", process.env.FIREBASE_AUTH_EMULATOR_HOST);
  console.log("  - FIRESTORE_EMULATOR_HOST:", process.env.FIRESTORE_EMULATOR_HOST);
  console.log("  - FIREBASE_STORAGE_EMULATOR_HOST:", process.env.FIREBASE_STORAGE_EMULATOR_HOST);

  admin.initializeApp();

  // Configure Firestore to ignore undefined properties
  // This must be called immediately after initializeApp and before any Firestore operations
  admin.firestore().settings({ignoreUndefinedProperties: true});
}

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {
  MealPlan,
  Recipe,
  GroceryList,
  UserOverrides,
  Category,
  RecipeDraft,
  COLLECTIONS,
} from "../../shared/types";
import {recomputeGroceryList} from "../../shared/groceryListEngine";
import {parseIngredientLine, generateCanonicalKey} from "../../shared/ingredientNormalizer";
import {startRecipeImport, processRecipeImport} from "./recipeImport";
import {parseRecipeFromText} from "../../shared/textRecipeParser";
import {requestEmailOtp, verifyEmailOtp} from "./auth";

interface RecomputeRequest {
  dateRangeStart: string;
  dateRangeEnd: string;
  mealPlanId?: string;
}

/**
 * Recompute grocery list from meal plan
 *
 * This is a callable function that can be invoked from the client,
 * but should not block the UI. The client should do optimistic updates.
 */
export const recomputeGroceryListFunction = onCall(
  {enforceAppCheck: false},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = request.auth.uid;
    const data = request.data as RecomputeRequest;
    const {dateRangeStart, dateRangeEnd, mealPlanId} = data;

    if (!dateRangeStart || !dateRangeEnd) {
      throw new HttpsError(
        "invalid-argument",
        "dateRangeStart and dateRangeEnd are required"
      );
    }

    try {
      const db = admin.firestore();

      // Get meal plan
      let mealPlan: MealPlan;
      if (mealPlanId) {
        const mealPlanDoc = await db
          .collection(COLLECTIONS.mealPlans)
          .doc(mealPlanId)
          .get();

        if (!mealPlanDoc.exists) {
          throw new HttpsError(
            "not-found",
            "Meal plan not found"
          );
        }

        mealPlan = {id: mealPlanDoc.id, ...mealPlanDoc.data()} as MealPlan;

        // Verify ownership
        if (mealPlan.userId !== userId) {
          throw new HttpsError(
            "permission-denied",
            "Not authorized to access this meal plan"
          );
        }
      } else {
        // Get user's meal plan for the date range
        const mealPlansSnapshot = await db
          .collection(COLLECTIONS.mealPlans)
          .where("userId", "==", userId)
          .where("startDate", ">=", dateRangeStart)
          .where("startDate", "<=", dateRangeEnd)
          .limit(1)
          .get();

        if (mealPlansSnapshot.empty) {
          throw new HttpsError(
            "not-found",
            "No meal plan found for the specified date range"
          );
        }

        const mealPlanDoc = mealPlansSnapshot.docs[0];
        mealPlan = {id: mealPlanDoc.id, ...mealPlanDoc.data()} as MealPlan;
      }

      // Get meal plan entries
      const entriesSnapshot = await db
        .collection(COLLECTIONS.mealPlanEntries)
        .where("planId", "==", mealPlan.id)
        .where("date", ">=", dateRangeStart)
        .where("date", "<=", dateRangeEnd)
        .get();

      mealPlan.entries = entriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MealPlan["entries"];

      // Get all unique recipe IDs
      const recipeIds = [...new Set(mealPlan.entries.map((e) => e.recipeId))];

      // Fetch recipes
      const recipes: Recipe[] = [];
      for (const recipeId of recipeIds) {
        const recipeDoc = await db
          .collection(COLLECTIONS.recipes)
          .doc(recipeId)
          .get();

        if (recipeDoc.exists) {
          recipes.push({
            id: recipeDoc.id,
            ...recipeDoc.data(),
          } as Recipe);
        }
      }

      // Get existing grocery list if any
      const existingListsSnapshot = await db
        .collection(COLLECTIONS.groceryLists)
        .where("userId", "==", userId)
        .where("scope.dateRangeStart", "==", dateRangeStart)
        .where("scope.dateRangeEnd", "==", dateRangeEnd)
        .limit(1)
        .get();

      let existingList: GroceryList | undefined;
      if (!existingListsSnapshot.empty) {
        const listDoc = existingListsSnapshot.docs[0];
        existingList = {
          id: listDoc.id,
          ...listDoc.data(),
        } as GroceryList;
      }

      // Get user overrides
      const overridesDoc = await db
        .collection(COLLECTIONS.userOverrides)
        .doc(userId)
        .get();

      let userOverrides: UserOverrides | undefined;
      if (overridesDoc.exists) {
        userOverrides = {
          userId,
          ...overridesDoc.data(),
        } as UserOverrides;
      }

      // Get categories
      const categoriesSnapshot = await db
        .collection(COLLECTIONS.categories)
        .orderBy("sortOrder")
        .get();

      const categories: Category[] = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Category[];

      // Recompute grocery list
      const newList = recomputeGroceryList({
        mealPlan,
        recipes,
        existingList,
        userOverrides,
        categories,
        dateRangeStart,
        dateRangeEnd,
      });

      // Save to Firestore
      const listRef = existingList ?
        db.collection(COLLECTIONS.groceryLists).doc(existingList.id) :
        db.collection(COLLECTIONS.groceryLists).doc();

      newList.id = listRef.id;

      await listRef.set(newList, {merge: false});

      return {
        success: true,
        listId: newList.id,
        version: newList.version,
      };
    } catch (error: any) {
      console.error("Error recomputing grocery list:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to recompute grocery list"
      );
    }
  }
);

interface NormalizeRequest {
  rawText: string;
}

/**
 * Normalize a single ingredient line
 * Useful for testing and client-side normalization
 */
export const normalizeIngredientFunction = onCall(
  {enforceAppCheck: false},
  async (request) => {
    const data = request.data as NormalizeRequest;
    const {rawText} = data;

    if (!rawText || typeof rawText !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "rawText is required and must be a string"
      );
    }

    try {
      const parsed = parseIngredientLine(rawText);
      const canonicalKey = generateCanonicalKey(parsed);

      return {
        parsed,
        canonicalKey,
      };
    } catch (error: any) {
      console.error("Error normalizing ingredient:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to normalize ingredient"
      );
    }
  }
);

/**
 * Firestore trigger: When meal plan entry is created/updated/deleted,
 * trigger grocery list recomputation (non-blocking)
 */
export const onMealPlanEntryChange = onDocumentWritten(
  `${COLLECTIONS.mealPlanEntries}/{entryId}`,
  async (event) => {
    const entryId = event.params.entryId;
    const entry = event.data?.after.exists ?
      event.data.after.data() :
      event.data?.before.data();

    if (!entry) return;

    const planId = entry.planId;
    if (!planId) return;

    // Get meal plan to find date range
    const db = admin.firestore();
    const mealPlanDoc = await db
      .collection(COLLECTIONS.mealPlans)
      .doc(planId)
      .get();

    if (!mealPlanDoc.exists) return null;

    const mealPlan = mealPlanDoc.data() as MealPlan;

    // Determine date range (use week of startDate)
    const startDate = new Date(mealPlan.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Week range

    const dateRangeStart = mealPlan.startDate;
    const dateRangeEnd = endDate.toISOString().split("T")[0];

    // Queue recomputation (don't block)
    // In production, you might want to use a task queue
    // For now, we'll just log - the client will trigger recompute on next sync
    console.log(`Meal plan entry ${entryId} changed, grocery list should be recomputed for ${dateRangeStart} to ${dateRangeEnd}`);

    return null;
  });

// Export recipe import functions
export {startRecipeImport, processRecipeImport};

// Export photo import functions
export {startPhotoImport, processPhotoImport} from "./photoImport";

// Helper function for rate limiting (shared with text parsing)
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const db = admin.firestore();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const MAX_IMPORTS_PER_DAY = 20;

  // Count imports in last 24 hours (both URL and text imports)
  const recentImports = await db
    .collection(COLLECTIONS.imports)
    .where("userId", "==", userId)
    .where("createdAt", ">=", oneDayAgo)
    .get();

  // Also count recent text parsing (recipe drafts created in last 24h)
  const recentDrafts = await db
    .collection(COLLECTIONS.recipeDrafts)
    .where("userId", "==", userId)
    .where("createdAt", ">=", oneDayAgo)
    .get();

  const count = recentImports.size + recentDrafts.size;

  if (count >= MAX_IMPORTS_PER_DAY) {
    return {
      allowed: false,
      message: `Maximum ${MAX_IMPORTS_PER_DAY} imports per day. Please try again tomorrow.`,
    };
  }

  return {allowed: true};
}

/**
 * Parse recipe from pasted text
 */
interface ParseTextRequest {
  rawText: string;
  source?: string;
}

export const parseRecipeFromTextFunction = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const data = request.data as ParseTextRequest;
    const {rawText, source} = data;

    if (!rawText || typeof rawText !== "string") {
      throw new HttpsError("invalid-argument", "rawText is required and must be a string");
    }

    // Validate text length
    const MAX_TEXT_LENGTH = 20000; // 20k chars
    if (rawText.length > MAX_TEXT_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `Text too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.`
      );
    }

    if (rawText.trim().length < 50) {
      throw new HttpsError(
        "invalid-argument",
        "Text too short. Please provide at least 50 characters of recipe text."
      );
    }

    // Check rate limit (same as URL import)
    const rateLimitCheck = await checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      // Parse the recipe
      const parseResult = parseRecipeFromText(rawText, source);

      // Create recipe draft in Firestore
      const db = admin.firestore();
      const draftRef = db.collection(COLLECTIONS.recipeDrafts).doc();
      const draftId = draftRef.id;

      // Helper function to remove undefined values from an object
      const removeUndefined = (obj: any): any => {
        if (obj === null) {
          return obj;
        }
        if (obj === undefined) {
          return null; // Convert undefined to null for Firestore
        }
        if (Array.isArray(obj)) {
          return obj.map(removeUndefined);
        }
        if (typeof obj === "object") {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              cleaned[key] = removeUndefined(value);
            }
          }
          return cleaned;
        }
        return obj;
      };

      // Remove all undefined values from the draft
      const cleanedDraft = removeUndefined(parseResult.draft);

      // Build the final draft object, ensuring no undefined values
      // Start with required fields and add all non-undefined properties from cleanedDraft
      const finalDraft: RecipeDraft = {
        id: draftId,
        userId,
        createdAt: Date.now(),
        ...cleanedDraft,
      } as RecipeDraft;

      // Final check: remove any undefined values that might have slipped through
      const cleanedFinalDraft: any = {};
      for (const [key, value] of Object.entries(finalDraft)) {
        if (value !== undefined) {
          cleanedFinalDraft[key] = value;
        }
      }

      // Verify no undefined values exist
      const hasUndefined = Object.values(cleanedFinalDraft).some((v) => v === undefined);
      if (hasUndefined) {
        console.error("ERROR: Found undefined values in draft:", cleanedFinalDraft);
        throw new Error("Draft contains undefined values");
      }

      // Verify userId is set
      if (!cleanedFinalDraft.userId) {
        console.error("ERROR: userId is missing from draft:", cleanedFinalDraft);
        throw new Error("Draft must have userId");
      }

      console.log("Saving draft to Firestore:", {
        draftId: cleanedFinalDraft.id,
        userId: cleanedFinalDraft.userId,
        hasImageUrl: !!cleanedFinalDraft.imageUrl,
      });

      await draftRef.set(cleanedFinalDraft);

      return {
        draftId,
        confidence: parseResult.confidence,
        warnings: parseResult.warnings,
      };
    } catch (error: any) {
      console.error("Error parsing recipe from text:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to parse recipe from text"
      );
    }
  }
);

/**
 * Classify recipe text into ingredients and instructions
 *
 * This function takes raw text and returns arrays of ingredients and instructions
 * as strings, without creating a draft. Used for preview/import flows.
 */
interface ClassifyRecipeTextRequest {
  text: string;
}

export const classifyRecipeText = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const data = request.data as ClassifyRecipeTextRequest;
    const {text} = data;

    if (!text || typeof text !== "string") {
      throw new HttpsError("invalid-argument", "text is required and must be a string");
    }

    // Validate text length
    const MAX_TEXT_LENGTH = 50000; // 50k chars for multi-page recipes
    if (text.length > MAX_TEXT_LENGTH) {
      throw new HttpsError(
        "invalid-argument",
        `Text too long. Maximum ${MAX_TEXT_LENGTH} characters allowed.`
      );
    }

    if (text.trim().length === 0) {
      throw new HttpsError("invalid-argument", "Text cannot be empty");
    }

    try {
      // Use the existing parser to classify the text
      const parseResult = parseRecipeFromText(text, "Photo import");

      // Convert ingredients to string array
      const ingredients = parseResult.draft.ingredients.map((ing) => ing.raw);

      // Convert instructions to string array
      const instructions = parseResult.draft.instructions.map((inst) => inst.text);

      return {
        ingredients: ingredients.length > 0 ? ingredients : [""],
        instructions: instructions.length > 0 ? instructions : [""],
        confidence: parseResult.confidence,
        warnings: parseResult.warnings,
      };
    } catch (error: any) {
      console.error("Error classifying recipe text:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to classify recipe text"
      );
    }
  }
);

// Export OTP authentication functions
export {requestEmailOtp, verifyEmailOtp};

// Export recipe management functions
export {createRecipe, updateRecipe, markRecipeAsCooked} from "./recipes";

// Export review functions
export {submitReview, getReview, getRecipeReviews} from "./reviews";

// Export user management functions
export {getUserCollections} from "./users";
