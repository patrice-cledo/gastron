/**
 * Recipe Reviews and Ratings Cloud Functions
 *
 * Functions:
 * - submitReview: Create or update a review for a recipe
 * - getReview: Get a user's review for a specific recipe
 * - getRecipeReviews: Get all reviews for a recipe (with pagination)
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  RecipeReview,
  COLLECTIONS,
} from "../../shared/types";

const db = admin.firestore();

interface SubmitReviewRequest {
  recipeId: string;
  rating: number; // 1-5
  comments?: string;
  imageUrl?: string;
  userName?: string;
}

/**
 * Submit or update a review for a recipe
 */
export const submitReview = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const data = request.data as SubmitReviewRequest;

    // Validate required fields
    if (!data.recipeId || typeof data.recipeId !== "string") {
      throw new HttpsError("invalid-argument", "Recipe ID is required");
    }

    if (!data.rating || typeof data.rating !== "number" || data.rating < 1 || data.rating > 5) {
      throw new HttpsError("invalid-argument", "Rating must be a number between 1 and 5");
    }

    // Validate optional fields
    if (data.comments !== undefined && typeof data.comments !== "string") {
      throw new HttpsError("invalid-argument", "Comments must be a string");
    }

    if (data.imageUrl !== undefined && typeof data.imageUrl !== "string") {
      throw new HttpsError("invalid-argument", "Image URL must be a string");
    }

    if (data.userName !== undefined && typeof data.userName !== "string") {
      throw new HttpsError("invalid-argument", "User name must be a string");
    }

    try {
      // Verify recipe exists
      const recipeRef = db.collection(COLLECTIONS.recipes).doc(data.recipeId);
      const recipeDoc = await recipeRef.get();

      if (!recipeDoc.exists) {
        throw new HttpsError("not-found", "Recipe not found");
      }

      // Check if user has permission to review this recipe
      const recipeData = recipeDoc.data();
      if (recipeData && recipeData.isPublic !== true && recipeData.userId !== userId) {
        throw new HttpsError("permission-denied", "You do not have permission to review this recipe");
      }

      const now = Date.now();

      // Check if user already has a review for this recipe
      const existingReviewQuery = await db
        .collection(COLLECTIONS.reviews)
        .where("recipeId", "==", data.recipeId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      let reviewId: string;
      let reviewData: RecipeReview;

      if (!existingReviewQuery.empty) {
        // Update existing review
        const existingReviewDoc = existingReviewQuery.docs[0];
        reviewId = existingReviewDoc.id;

        reviewData = {
          id: reviewId,
          recipeId: data.recipeId,
          userId,
          rating: data.rating,
          comments: data.comments?.trim() || undefined,
          imageUrl: data.imageUrl || undefined,
          userName: data.userName?.trim() || undefined,
          createdAt: existingReviewDoc.data().createdAt, // Keep original creation time
          updatedAt: now,
        };

        await existingReviewDoc.ref.update({
          rating: data.rating,
          comments: data.comments?.trim() || admin.firestore.FieldValue.delete(),
          imageUrl: data.imageUrl || admin.firestore.FieldValue.delete(),
          userName: data.userName?.trim() || admin.firestore.FieldValue.delete(),
          updatedAt: now,
        });

        console.log(`Review updated: ${reviewId} for recipe ${data.recipeId} by user ${userId}`);
      } else {
        // Create new review
        const reviewRef = db.collection(COLLECTIONS.reviews).doc();
        reviewId = reviewRef.id;

        reviewData = {
          id: reviewId,
          recipeId: data.recipeId,
          userId,
          rating: data.rating,
          comments: data.comments?.trim() || undefined,
          imageUrl: data.imageUrl || undefined,
          userName: data.userName?.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };

        await reviewRef.set(reviewData);

        console.log(`Review created: ${reviewId} for recipe ${data.recipeId} by user ${userId}`);
      }

      return {
        reviewId,
        review: reviewData,
      };
    } catch (error: any) {
      console.error("Error submitting review:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to submit review");
    }
  }
);

interface GetReviewRequest {
  recipeId: string;
}

/**
 * Get a user's review for a specific recipe
 */
export const getReview = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const data = request.data as GetReviewRequest;

    // Validate required fields
    if (!data.recipeId || typeof data.recipeId !== "string") {
      throw new HttpsError("invalid-argument", "Recipe ID is required");
    }

    try {
      const reviewQuery = await db
        .collection(COLLECTIONS.reviews)
        .where("recipeId", "==", data.recipeId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (reviewQuery.empty) {
        return {
          review: null,
        };
      }

      const reviewDoc = reviewQuery.docs[0];
      const reviewData = {
        id: reviewDoc.id,
        ...reviewDoc.data(),
      } as RecipeReview;

      return {
        review: reviewData,
      };
    } catch (error: any) {
      console.error("Error getting review:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to get review");
    }
  }
);

interface GetRecipeReviewsRequest {
  recipeId: string;
  limit?: number;
  startAfter?: string; // Review ID for pagination
}

/**
 * Get all reviews for a recipe (public reviews only)
 */
export const getRecipeReviews = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    const data = request.data as GetRecipeReviewsRequest;

    // Validate required fields
    if (!data.recipeId || typeof data.recipeId !== "string") {
      throw new HttpsError("invalid-argument", "Recipe ID is required");
    }

    const limit = data.limit && data.limit > 0 && data.limit <= 50 ? data.limit : 20;

    try {
      let query = db
        .collection(COLLECTIONS.reviews)
        .where("recipeId", "==", data.recipeId)
        .orderBy("createdAt", "desc")
        .limit(limit);

      // Handle pagination
      if (data.startAfter) {
        const startAfterDoc = await db.collection(COLLECTIONS.reviews).doc(data.startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      const reviewsSnapshot = await query.get();

      const reviews = reviewsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RecipeReview[];

      return {
        reviews,
        hasMore: reviews.length === limit,
        lastReviewId: reviews.length > 0 ? reviews[reviews.length - 1].id : null,
      };
    } catch (error: any) {
      console.error("Error getting recipe reviews:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", error.message || "Failed to get recipe reviews");
    }
  }
);
