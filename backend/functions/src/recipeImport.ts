/**
 * Recipe Import Cloud Functions
 *
 * Functions:
 * - startRecipeImport: Callable function to start import job
 * - processRecipeImport: Background function triggered by Firestore to process import
 */

import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {
  ImportJob,
  RecipeDraft,
  ErrorCode,
  COLLECTIONS,
} from "../../shared/types";
import {extractRecipe} from "../../shared/recipeExtractor";
import {validateImportUrl} from "../../shared/securityUtils";

// Configuration
const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_IMPORTS_PER_DAY = 20; // Rate limit

interface StartImportRequest {
  url: string;
}

/**
 * Start recipe import job
 *
 * Creates an import job and triggers background processing
 */
export const startRecipeImport = onCall(
  {enforceAppCheck: false, maxInstances: 10},
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const userId = request.auth.uid;
    const data = request.data as StartImportRequest;
    const {url} = data;

    if (!url || typeof url !== "string") {
      throw new HttpsError("invalid-argument", "URL is required");
    }

    // Validate URL
    const validation = validateImportUrl(url);
    if (!validation.valid) {
      throw new HttpsError("invalid-argument", validation.reason || "Invalid URL");
    }

    // Check rate limit
    const rateLimitCheck = await checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      // Create import job
      const db = admin.firestore();
      const importRef = db.collection(COLLECTIONS.imports).doc();
      const importId = importRef.id;

      const importJob: Omit<ImportJob, "id"> = {
        userId,
        sourceUrl: url,
        status: "queued",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        errorCode: null,
        errorMessage: null,
        result: null,
        metrics: null,
      };

      await importRef.set(importJob);

      // The onDocumentCreated trigger will fire automatically
      // We'll process it in the background

      return {importId};
    } catch (error: any) {
      console.error("Error starting import:", error);
      throw new HttpsError("internal", error.message || "Failed to start import");
    }
  }
);

/**
 * Process recipe import (background function)
 *
 * Triggered when import job is created
 */
export const processRecipeImport = onDocumentCreated(
  {
    document: `${COLLECTIONS.imports}/{importId}`,
    maxInstances: 5,
  },
  async (event) => {
    const importId = event.params.importId;
    const importData = event.data?.data() as ImportJob | undefined;

    if (!importData || importData.status !== "queued") {
      return; // Only process when status is 'queued' (newly created)
    }

    // Only process URL imports, not photo imports
    if (importData.source === "photo") {
      return; // Photo imports are handled by processPhotoImport
    }

    const db = admin.firestore();
    const importRef = db.collection(COLLECTIONS.imports).doc(importId);

    try {
      // Update status to extracting
      await importRef.update({
        status: "extracting",
        updatedAt: Date.now(),
      });

      // Fetch HTML
      if (!importData.sourceUrl) {
        throw new Error("Missing sourceUrl for URL import");
      }

      const fetchStart = Date.now();
      const html = await fetchHtml(importData.sourceUrl);
      const fetchMs = Date.now() - fetchStart;

      if (!html) {
        throw new Error("Failed to fetch HTML content");
      }

      // Extract recipe
      const extractStart = Date.now();
      const extractionResult = extractRecipe(html, importData.sourceUrl);
      const extractMs = Date.now() - extractStart;

      // Create recipe draft
      const draftRef = db.collection(COLLECTIONS.recipeDrafts).doc();
      const draftId = draftRef.id;

      const draft: RecipeDraft = {
        ...extractionResult.draft,
        id: draftId,
        userId: importData.userId,
      };

      await draftRef.set(draft);

      // Update import job with result
      await importRef.update({
        status: "ready",
        updatedAt: Date.now(),
        result: {
          recipeDraftId: draftId,
          confidence: extractionResult.confidence,
          parser: extractionResult.parser,
          warnings: extractionResult.warnings,
        },
        metrics: {
          fetchMs,
          extractMs,
          contentBytes: html.length,
        },
      });

      console.log(`Import ${importId} completed successfully`);
    } catch (error: any) {
      console.error(`Import ${importId} failed:`, error);

      let errorCode: ErrorCode = "PARSING_ERROR";
      const errorMessage = error.message || "Unknown error";

      // Classify error
      if (error.message?.includes("timeout") || error.message?.includes("TIMEOUT")) {
        errorCode = "TIMEOUT";
      } else if (error.message?.includes("fetch") || error.message?.includes("network")) {
        errorCode = "FETCH_FAILED";
      } else if (error.message?.includes("blocked") || error.message?.includes("SSRF")) {
        errorCode = "SSRF_BLOCKED";
      } else if (error.message?.includes("rate limit")) {
        errorCode = "RATE_LIMIT_EXCEEDED";
      }

      await importRef.update({
        status: "failed",
        updatedAt: Date.now(),
        errorCode,
        errorMessage,
      });
    }
  }
);

/**
 * Fetch HTML from URL with security constraints
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CookThisPage/1.0; +https://cookthispage.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    } as RequestInit);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_SIZE) {
      throw new Error("Content too large");
    }

    const html = await response.text();

    if (html.length > MAX_CONTENT_SIZE) {
      throw new Error("Content too large");
    }

    return html;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const db = admin.firestore();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Count imports in last 24 hours
  const recentImports = await db
    .collection(COLLECTIONS.imports)
    .where("userId", "==", userId)
    .where("createdAt", ">=", oneDayAgo)
    .get();

  const count = recentImports.size;

  if (count >= MAX_IMPORTS_PER_DAY) {
    return {
      allowed: false,
      message: `Maximum ${MAX_IMPORTS_PER_DAY} imports per day. Please try again tomorrow.`,
    };
  }

  return {allowed: true};
}
