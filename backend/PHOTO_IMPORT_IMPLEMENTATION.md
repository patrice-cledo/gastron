# Photo Import Backend Implementation

This document describes the backend implementation for photo/screenshot recipe import functionality using Google Cloud Vision API OCR.

## Overview

The backend supports importing recipes from photos/screenshots by:
1. Accepting image uploads to Firebase Storage
2. Performing OCR using Google Cloud Vision API
3. Parsing OCR text into structured recipe data using heuristic parsing
4. Storing results as recipe drafts for user review

## Architecture

### Cloud Functions

#### `startPhotoImport` (Callable)
- **Purpose**: Start a new photo import job
- **Input**: `{ storagePath: string }` (e.g., `"imports/uid_123/imp_abc.jpg"`)
- **Output**: `{ importId: string }`
- **Security**:
  - Requires authentication
  - Validates storage path belongs to user (`imports/{userId}/...`)
  - Validates file exists and size <= 6 MB
  - Rate limiting (5 photo imports/day for free tier)
- **Behavior**:
  - Creates import job in Firestore with status `queued`
  - Triggers background processing via Firestore trigger

#### `processPhotoImport` (Background)
- **Purpose**: Process photo import job in the background
- **Trigger**: Firestore document creation in `/imports/{importId}` with `source: 'photo'`
- **Steps**:
  1. Update status to `ocr`
  2. Read image bytes from Firebase Storage
  3. Call Google Cloud Vision API OCR (Document Text Detection)
  4. Sanitize OCR output (normalize whitespace, fix common OCR mistakes)
  5. Update status to `extracting`
  6. Parse OCR text into structured recipe using heuristic parser
  7. Create recipe draft
  8. Update import job with result

### Data Models

#### ImportJob (`/imports/{importId}`)
```typescript
{
  id: string;
  userId: string;
  source: 'photo' | 'url';
  sourceUrl?: string; // For URL imports
  storagePath?: string; // For photo imports: "imports/uid_123/imp_abc.jpg"
  status: 'queued' | 'ocr' | 'extracting' | 'ready' | 'failed';
  createdAt: number;
  updatedAt: number;
  errorCode?: ErrorCode | null;
  errorMessage?: string | null;
  result?: {
    recipeDraftId: string;
    confidence: number; // 0..1
    parser: 'vision_ocr+heuristic';
    warnings: string[];
  } | null;
  metrics?: {
    ocrMs: number;
    extractMs: number;
    imageBytes: number;
  } | null;
}
```

#### RecipeDraft (`/recipeDrafts/{draftId}`)
```typescript
{
  id: string;
  userId: string;
  source: 'photo';
  importId: string;
  imageStoragePath: string; // "imports/uid_123/imp_abc.jpg"
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
  confidence: number; // 0..1
  parser: 'vision_ocr+heuristic';
  warnings?: string[];
  ocrText?: string | null; // Raw OCR text (truncated to 5000 chars for debugging)
  createdAt: number;
}
```

## OCR Processing

### Google Cloud Vision API

- **API**: Document Text Detection (`documentTextDetection`)
- **Input**: Image buffer from Firebase Storage
- **Output**: Full text annotation with detected text

### OCR Text Sanitization

The OCR output is sanitized to fix common mistakes:

1. **Normalize line breaks**: `\r\n` → `\n`
2. **Fix common OCR mistakes**:
   - `I tsp` → `1 tsp` (when followed by unit)
   - `O` → `0` in temperature/time contexts
   - Character confusions (`|` → `l`, context-aware `0`/`O` conversion)
3. **Normalize whitespace**: Multiple spaces → single space
4. **Normalize newlines**: Max 2 consecutive newlines

## Recipe Parsing

The OCR text is parsed using the same heuristic parser as text imports (`textRecipeParser.ts`):

1. **Section Detection**: Finds "Ingredients", "Instructions", "Directions", etc.
2. **Ingredient Extraction**: Parses ingredient lines with quantities, units, and names
3. **Instruction Extraction**: Splits into numbered steps
4. **Metadata Extraction**: Extracts servings, prep time, cook time

## Error Handling

### Error Codes
- `IMAGE_TOO_LARGE`: Image exceeds 6 MB limit
- `OCR_NO_TEXT`: OCR did not extract sufficient text (< 50 chars)
- `OCR_FAILED`: Vision API error or file not found
- `RATE_LIMIT_EXCEEDED`: User exceeded daily limit

### UX Mapping
- Show actionable suggestions:
  - Crop tighter
  - Retake with better lighting
  - Use paste text instead
  - Manual entry

## Security

### Firestore Rules
- `/imports/{importId}`: Users can read/create their own imports
- `/recipeDrafts/{draftId}`: Users can read/update their own drafts

### Storage Rules
- `/imports/{userId}/{fileName}`: Users can read/write their own import images
- Max file size: 6 MB
- Content type: Images only

## Rate Limiting

- **Free tier**: 5 photo imports per day
- **Premium tier**: 100 photo imports per day (TODO: implement tier checking)

Rate limits are enforced per user based on imports created in the last 24 hours.

## Configuration

Constants in `photoImport.ts`:
- `MAX_IMAGE_SIZE`: 6 MB
- `MAX_PHOTO_IMPORTS_PER_DAY`: 5 (free tier)

## Usage Flow

1. **Client uploads image to Storage**:
   ```typescript
   const storageRef = storage.ref(`imports/${userId}/${importId}.jpg`);
   await storageRef.put(imageBlob);
   ```

2. **Client calls `startPhotoImport`**:
   ```typescript
   const result = await functions.httpsCallable('startPhotoImport')({
     storagePath: `imports/${userId}/${importId}.jpg`
   });
   const { importId } = result.data;
   ```

3. **Client listens to import status**:
   ```typescript
   const unsubscribe = db
     .collection('imports')
     .doc(importId)
     .onSnapshot((snapshot) => {
       const importJob = snapshot.data() as ImportJob;
       if (importJob.status === 'ocr') {
         // Show "Reading text..." message
       } else if (importJob.status === 'extracting') {
         // Show "Building recipe..." message
       } else if (importJob.status === 'ready') {
         // Navigate to preview with importJob.result.recipeDraftId
       } else if (importJob.status === 'failed') {
         // Show error
       }
     });
   ```

4. **Client loads recipe draft**:
   ```typescript
   const draft = await db
     .collection('recipeDrafts')
     .doc(draftId)
     .get();
   ```

5. **Client saves recipe** (converts draft to recipe):
   ```typescript
   const recipe = convertDraftToRecipe(draft.data());
   await db.collection('recipes').add(recipe);
   ```

## Testing

### Test Images
- Cookbook photos with clear text
- Screenshots of recipe websites
- Handwritten recipes (may have lower OCR accuracy)

### Manual Testing
1. Upload image to Storage
2. Call `startPhotoImport` with storage path
3. Monitor Firestore `/imports/{importId}` document
4. Check `/recipeDrafts/{draftId}` when status is `ready`
5. Verify extracted data quality

## Dependencies

- `@google-cloud/vision`: Google Cloud Vision API client
- Firebase Admin SDK: For Storage and Firestore access
- Shared modules: `textRecipeParser.ts`, `ingredientNormalizer.ts`

## Setup

1. **Enable Google Cloud Vision API**:
   ```bash
   gcloud services enable vision.googleapis.com
   ```

2. **Set up authentication**:
   - Use Application Default Credentials (ADC) for local development
   - Use service account for production deployment

3. **Install dependencies**:
   ```bash
   cd backend/functions
   npm install @google-cloud/vision
   ```

4. **Deploy functions**:
   ```bash
   npm run deploy
   ```

## Future Enhancements

1. **Image preprocessing**: Client-side compression/resize before upload
2. **Crop screen**: Allow users to crop image to recipe area
3. **Multiple pages**: Support multi-page recipe imports
4. **LLM enhancement**: Use LLM to improve parsing accuracy (optional)
5. **Image re-hosting**: Copy import image to recipe images folder
6. **Thumbnail generation**: Generate thumbnails for preview
7. **OCR confidence scoring**: Use Vision API confidence scores
8. **Tier-based rate limits**: Implement premium tier checking
