/**
 * Photo Import Cloud Functions
 * 
 * Functions:
 * - startPhotoImport: Callable function to start photo import job
 * - processPhotoImport: Background function triggered by Firestore to process photo import
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import {
  ImportJob,
  ErrorCode,
  COLLECTIONS,
} from '../../shared/types';
import { parseRecipeFromText } from '../../shared/textRecipeParser';

// Configuration
const MAX_IMAGE_SIZE = 6 * 1024 * 1024; // 6 MB
// For local development, use a much higher limit
const MAX_PHOTO_IMPORTS_PER_DAY = process.env.FUNCTIONS_EMULATOR 
  ? 1000 // Very high limit for local development
  : 5; // Rate limit for free tier in production
// const MAX_PHOTO_IMPORTS_PER_DAY_PREMIUM = 100; // Rate limit for premium (TODO: implement tier checking)

// Initialize Vision API client
let visionClient: ImageAnnotatorClient | null = null;
function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient();
  }
  return visionClient;
}

interface StartPhotoImportRequest {
  storagePath: string;
}

/**
 * Start photo import job
 * 
 * Creates an import job and triggers background processing
 */
export const startPhotoImport = onCall(
  { enforceAppCheck: false, maxInstances: 10 },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = request.auth.uid;
    const data = request.data as StartPhotoImportRequest;
    const { storagePath } = data;

    if (!storagePath || typeof storagePath !== 'string') {
      throw new HttpsError('invalid-argument', 'storagePath is required');
    }

    // Validate storage path belongs to user
    if (!storagePath.startsWith(`imports/${userId}/`)) {
      throw new HttpsError(
        'permission-denied',
        'Storage path must belong to the authenticated user'
      );
    }

    // Check if file exists and get size
    // Explicitly specify bucket name for emulator compatibility
    const bucketName = process.env.STORAGE_BUCKET || 'cookthispage.appspot.com';
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(storagePath);
    
    console.log(`🔍 Checking file in bucket: ${bucketName}, path: ${storagePath}`);
    
    try {
      const [exists] = await file.exists();
      
      if (exists) {
        const [metadata] = await file.getMetadata();
        const fileSize = parseInt(String(metadata.size || '0'), 10);
        
        if (fileSize > MAX_IMAGE_SIZE) {
          throw new HttpsError(
            'invalid-argument',
            `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024} MB`
          );
        }
      }
    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }
      // If file doesn't exist, we'll still create the job but it will fail in processing
      console.warn(`File ${storagePath} may not exist:`, error);
    }

    // Check rate limit
    const rateLimitCheck = await checkPhotoRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded. ${rateLimitCheck.message}`
      );
    }

    try {
      // Extract importId from storagePath
      // storagePath format: imports/{userId}/{importId}.jpg
      const pathParts = storagePath.split('/');
      if (pathParts.length !== 3) {
        throw new HttpsError('invalid-argument', 'Invalid storage path format');
      }
      const fileName = pathParts[2]; // e.g., "imp_1768772151127_wrymvjnxl.jpg"
      const importId = fileName.replace(/\.(jpg|jpeg|png)$/i, ''); // Remove extension

      console.log(`📸 Photo import: extracted importId=${importId} from storagePath=${storagePath}`);

      // Create import job with the importId from the storage path
      const db = admin.firestore();
      const importRef = db.collection(COLLECTIONS.imports).doc(importId);

      const importJob: ImportJob = {
        id: importId,
        userId,
        source: 'photo',
        storagePath,
        status: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        errorCode: null,
        errorMessage: null,
        result: null,
        metrics: null,
      };

      await importRef.set(importJob);
      console.log(`✅ Created import job ${importId} with storagePath: ${storagePath}`);

      // The onDocumentCreated trigger will fire automatically
      // We'll process it in the background

      return { importId };
    } catch (error: any) {
      console.error('Error starting photo import:', error);
      throw new HttpsError('internal', error.message || 'Failed to start photo import');
    }
  }
);

/**
 * Process photo import (background function)
 * 
 * Triggered when import job is created
 */
export const processPhotoImport = onDocumentCreated(
  {
    document: `${COLLECTIONS.imports}/{importId}`,
    maxInstances: 5,
  },
  async (event) => {
    const importId = event.params.importId;
    const importData = event.data?.data() as ImportJob | undefined;

    if (!importData || importData.status !== 'queued' || importData.source !== 'photo') {
      return; // Only process photo imports when status is 'queued'
    }

    if (!importData.storagePath) {
      console.error(`Import ${importId} missing storagePath`);
      return;
    }

    const db = admin.firestore();
    const importRef = db.collection(COLLECTIONS.imports).doc(importId);

    try {
      // Update status to ocr
      await importRef.update({
        status: 'ocr',
        updatedAt: Date.now(),
      });

      // Read image from Storage
      // Explicitly specify bucket name for emulator compatibility
      const bucketName = process.env.STORAGE_BUCKET || 'cookthispage.appspot.com';
      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(importData.storagePath);
      
      console.log(`🔍 Looking for file in bucket: ${bucketName}, path: ${importData.storagePath}`);
      
      // Wait a bit and retry if file doesn't exist immediately (storage eventual consistency)
      // Storage emulator may need more time to make files available
      let exists = false;
      let retries = 5;
      let waitTime = 2000; // Start with 2 seconds
      while (!exists && retries > 0) {
        [exists] = await file.exists();
        if (!exists) {
          console.log(`File ${importData.storagePath} not found, retrying... (${retries} retries left, waiting ${waitTime}ms)`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          waitTime += 1000; // Increase wait time with each retry
          retries--;
        }
      }
      
      // Log file metadata if it exists
      if (exists) {
        try {
          const [metadata] = await file.getMetadata();
          console.log(`✅ File found! Size: ${metadata.size} bytes, ContentType: ${metadata.contentType}`);
        } catch (metaError) {
          console.warn('Could not get file metadata:', metaError);
        }
      }
      
      if (!exists) {
        throw new Error('Image file not found in storage');
      }

      const [imageBuffer] = await file.download();
      const imageBytes = imageBuffer.length;

      if (imageBytes > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large: ${imageBytes} bytes`);
      }

      // Perform OCR
      const ocrStart = Date.now();
      const ocrText = await performOCR(imageBuffer);
      const ocrMs = Date.now() - ocrStart;

      if (!ocrText || ocrText.trim().length < 50) {
        throw new Error('OCR did not extract sufficient text from image');
      }

      // Sanitize OCR text
      const sanitizedText = sanitizeOCRText(ocrText);

      // Update status to extracting
      await importRef.update({
        status: 'extracting',
        updatedAt: Date.now(),
      });

      // Parse recipe from OCR text
      const extractStart = Date.now();
      const parseResult = parseRecipeFromText(sanitizedText);
      const extractMs = Date.now() - extractStart;

      // Create recipe draft
      const draftRef = db.collection(COLLECTIONS.recipeDrafts).doc();
      const draftId = draftRef.id;

      // Build draft object, only including defined fields (omit undefined)
      // Start with parsed draft but remove any undefined values
      const parsedDraft = parseResult.draft;
      const draft: any = {
        id: draftId,
        userId: importData.userId,
        source: 'photo',
        importId,
        imageStoragePath: importData.storagePath,
        parser: 'vision_ocr+heuristic',
        createdAt: Date.now(),
      };

      // Copy fields from parsed draft, only if they're defined
      if (parsedDraft.title) draft.title = parsedDraft.title;
      
      // Clean ingredients array - remove undefined values from each ingredient
      if (parsedDraft.ingredients) {
        draft.ingredients = parsedDraft.ingredients.map((ing: any) => {
          const cleaned: any = {
            raw: ing.raw || '',
          };
          if (ing.name) cleaned.name = ing.name;
          if (ing.quantity !== undefined && ing.quantity !== null) cleaned.quantity = ing.quantity;
          if (ing.unit) cleaned.unit = ing.unit;
          if (ing.notes) cleaned.notes = ing.notes; // Only include notes if it's defined and not empty
          return cleaned;
        });
      }
      
      // Clean instructions array - ensure all required fields are present
      if (parsedDraft.instructions) {
        draft.instructions = parsedDraft.instructions.map((inst: any, index: number) => {
          const cleaned: any = {
            step: inst.step !== undefined ? inst.step : index + 1,
            text: inst.text || inst.description || '',
          };
          return cleaned;
        });
      }
      if (parsedDraft.servings !== undefined && parsedDraft.servings !== null) draft.servings = parsedDraft.servings;
      if (parsedDraft.prepMinutes !== undefined && parsedDraft.prepMinutes !== null) draft.prepMinutes = parsedDraft.prepMinutes;
      if (parsedDraft.cookMinutes !== undefined && parsedDraft.cookMinutes !== null) draft.cookMinutes = parsedDraft.cookMinutes;
      if (parsedDraft.totalMinutes !== undefined && parsedDraft.totalMinutes !== null) draft.totalMinutes = parsedDraft.totalMinutes;
      if (parsedDraft.tags) draft.tags = parsedDraft.tags;
      if (parsedDraft.confidence !== undefined) draft.confidence = parsedDraft.confidence;
      if (parsedDraft.warnings) draft.warnings = parsedDraft.warnings;
      if (parsedDraft.imageUrl) draft.imageUrl = parsedDraft.imageUrl;

      // Store OCR text for debugging (optional, can be truncated)
      if (sanitizedText) {
        draft.ocrText = sanitizedText.length > 5000 ? sanitizedText.substring(0, 5000) + '...' : sanitizedText;
      }

      // Don't include sourceUrl for photo imports (it's only for URL imports)

      await draftRef.set(draft);

      // Update import job with result
      await importRef.update({
        status: 'ready',
        updatedAt: Date.now(),
        result: {
          recipeDraftId: draftId,
          confidence: parseResult.confidence,
          parser: 'vision_ocr+heuristic',
          warnings: parseResult.warnings,
        },
        metrics: {
          ocrMs,
          extractMs,
          imageBytes,
        },
      });

      console.log(`Photo import ${importId} completed successfully`);
    } catch (error: any) {
      console.error(`Photo import ${importId} failed:`, error);

      let errorCode: ErrorCode = 'OCR_FAILED';
      let errorMessage = error.message || 'Unknown error';

      // Classify error
      if (error.message?.includes('too large') || error.message?.includes('IMAGE_TOO_LARGE')) {
        errorCode = 'IMAGE_TOO_LARGE';
      } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
        errorCode = 'OCR_FAILED';
        errorMessage = 'Image file not found';
      } else if (error.message?.includes('insufficient text') || error.message?.includes('OCR_NO_TEXT')) {
        errorCode = 'OCR_NO_TEXT';
      } else if (error.message?.includes('rate limit')) {
        errorCode = 'RATE_LIMIT_EXCEEDED';
      }

      await importRef.update({
        status: 'failed',
        updatedAt: Date.now(),
        errorCode,
        errorMessage,
      });
    }
  }
);

/**
 * Perform OCR on image using Google Cloud Vision API
 */
async function performOCR(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient();
  
  try {
    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
    });

    const fullTextAnnotation = result.fullTextAnnotation;
    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      throw new Error('No text detected in image');
    }

    return fullTextAnnotation.text;
  } catch (error: any) {
    console.error('Vision API error:', error);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Sanitize OCR text: normalize whitespace, fix common OCR mistakes
 */
function sanitizeOCRText(text: string): string {
  let sanitized = text;

  // Normalize line breaks
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Fix common OCR mistakes in recipe context
  // I tsp → 1 tsp (when followed by unit)
  sanitized = sanitized.replace(/\bI\s+(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l)\b/gi, '1 $1');
  
  // O → 0 in temperature/time contexts
  sanitized = sanitized.replace(/\bO\s*(°|F|C|min|minute|hour|hr)\b/gi, '0$1');
  sanitized = sanitized.replace(/\b(\d+)\s*O\b/g, '$1 0');

  // Fix common character confusions
  sanitized = sanitized.replace(/[|]/g, 'l'); // pipe to lowercase L
  sanitized = sanitized.replace(/[0O]/g, (match, offset, str) => {
    // Context-aware: if followed by unit, likely 0; if in word, likely O
    const next = str.substring(offset + 1, offset + 5);
    if (/^\s*(tsp|tbsp|cup|cups|oz|lb|g|kg|ml|l|min|minute|hour|hr|°)/i.test(next)) {
      return '0';
    }
    return match;
  });

  // Normalize whitespace (multiple spaces to single)
  sanitized = sanitized.replace(/[ \t]+/g, ' ');
  
  // Normalize multiple newlines (keep max 2 consecutive)
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized.trim();
}

/**
 * Check rate limit for photo imports
 */
async function checkPhotoRateLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const db = admin.firestore();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // TODO: Check user subscription tier (free vs premium)
  // For now, use free tier limit
  const maxImports = MAX_PHOTO_IMPORTS_PER_DAY;

  // Count photo imports in last 24 hours
  const recentImports = await db
    .collection(COLLECTIONS.imports)
    .where('userId', '==', userId)
    .where('source', '==', 'photo')
    .where('createdAt', '>=', oneDayAgo)
    .get();

  const count = recentImports.size;

  if (count >= maxImports) {
    return {
      allowed: false,
      message: `Maximum ${maxImports} photo imports per day. Please try again tomorrow.`,
    };
  }

  return { allowed: true };
}
