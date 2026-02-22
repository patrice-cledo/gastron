/**
 * User Management Cloud Functions
 *
 * Functions:
 * - getUserCollections: Get user's recipe collections
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {COLLECTIONS} from "../../shared/types";

// Firebase Admin is initialized in index.ts before this module is imported
const db = admin.firestore();

// Default collections that all users have
const DEFAULT_COLLECTIONS = ["Favorites", "Want to cook"];

/**
 * Get user's recipe collections
 *
 * Returns the user's collections merged with default collections.
 * If the user document doesn't exist, it will be created with empty collections.
 */
export const getUserCollections = onCall(
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

    try {
      const userDocRef = db.collection(COLLECTIONS.users).doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const savedCollections = userData?.collections;

        if (Array.isArray(savedCollections) && savedCollections.length > 0) {
          // Merge with defaults, avoiding duplicates
          const merged = [...DEFAULT_COLLECTIONS];
          savedCollections.forEach((col: string) => {
            if (typeof col === "string" && col.trim() && !merged.includes(col)) {
              merged.push(col);
            }
          });
          return {
            collections: merged,
          };
        } else {
          // User exists but has no custom collections
          return {
            collections: DEFAULT_COLLECTIONS,
          };
        }
      } else {
        // User document doesn't exist, create it with default collections
        await userDocRef.set({
          userId,
          collections: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: false});

        return {
          collections: DEFAULT_COLLECTIONS,
        };
      }
    } catch (error: any) {
      console.error("Error loading user collections:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError(
        "internal",
        error.message || "Failed to load user collections"
      );
    }
  }
);
