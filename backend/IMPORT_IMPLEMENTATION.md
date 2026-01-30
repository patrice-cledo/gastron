# Recipe Import Backend Implementation

This document describes the backend implementation for browser-based recipe import functionality.

## Overview

The backend supports importing recipes from web URLs by:
1. Validating and accepting import requests
2. Fetching HTML content from the URL
3. Extracting recipe data using JSON-LD structured data
4. Storing results as recipe drafts for user review

## Architecture

### Cloud Functions

#### `startRecipeImport` (Callable)
- **Purpose**: Start a new recipe import job
- **Input**: `{ url: string }`
- **Output**: `{ importId: string }`
- **Security**:
  - Requires authentication
  - Validates URL (SSRF protection)
  - Rate limiting (20 imports/day per user)
- **Behavior**:
  - Creates import job in Firestore with status `queued`
  - Triggers background processing via Firestore trigger

#### `processRecipeImport` (Background)
- **Purpose**: Process import job in the background
- **Trigger**: Firestore document creation in `/imports/{importId}`
- **Steps**:
  1. Fetch HTML from URL (with timeout and size limits)
  2. Extract recipe using JSON-LD parser
  3. Create recipe draft
  4. Update import job with result

### Data Models

#### ImportJob (`/imports/{importId}`)
```typescript
{
  id: string;
  userId: string;
  sourceUrl: string;
  status: 'queued' | 'fetching' | 'extracting' | 'ready' | 'failed';
  createdAt: number;
  updatedAt: number;
  errorCode?: ErrorCode | null;
  errorMessage?: string | null;
  result?: {
    recipeDraftId: string;
    confidence: number;
    parser: 'jsonld' | 'microdata' | 'heuristic';
    warnings: string[];
  } | null;
  metrics?: {
    fetchMs: number;
    extractMs: number;
    contentBytes: number;
  } | null;
}
```

#### RecipeDraft (`/recipeDrafts/{draftId}`)
```typescript
{
  id: string;
  userId: string;
  sourceUrl: string;
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
  confidence: number;
  parser: 'jsonld' | 'microdata' | 'heuristic';
  warnings?: string[];
  createdAt: number;
}
```

## Extraction Strategy

### Priority 1: JSON-LD (Implemented)
- Parses `<script type="application/ld+json">` tags
- Looks for `@type: "Recipe"` or `"https://schema.org/Recipe"`
- Extracts:
  - Title (`name` or `headline`)
  - Image (`image`)
  - Servings (`recipeYield`)
  - Times (`prepTime`, `cookTime`, `totalTime`)
  - Ingredients (`recipeIngredient`)
  - Instructions (`recipeInstructions`)
  - Tags (`recipeCategory`, `keywords`)

### Priority 2: Microdata/RDFa (Phase 2)
- Not yet implemented
- Will parse HTML5 microdata and RDFa attributes

### Priority 3: Heuristic Parsing (Phase 2)
- Not yet implemented
- Will use pattern matching for common HTML structures

## Security Features

### SSRF Protection
- Blocks localhost and private IP ranges
- Blocks file://, chrome://, about: protocols
- Validates URL format

### Rate Limiting
- 20 imports per day per user (configurable)
- Enforced at function level

### Content Limits
- Max content size: 5 MB
- Fetch timeout: 10 seconds
- Aborts requests that exceed limits

### URL Validation
- Must be HTTP or HTTPS
- Blocks private IP ranges (RFC 1918)
- Blocks link-local addresses
- Optional allowlist/denylist support

## Error Handling

### Error Codes
- `FETCH_FAILED`: Network or HTTP error
- `BLOCKED_DOMAIN`: Domain in denylist
- `PAYWALL_OR_LOGIN`: Detected paywall/login requirement
- `NO_RECIPE_FOUND`: No recipe data found
- `PARSING_ERROR`: Extraction failed
- `TIMEOUT`: Request timed out
- `RATE_LIMIT_EXCEEDED`: User exceeded rate limit
- `INVALID_URL`: URL validation failed
- `SSRF_BLOCKED`: SSRF protection triggered

### Confidence Scoring
- Starts at 1.0
- Deducts for missing fields:
  - Missing title: -0.2
  - Missing ingredients: -0.3
  - Missing instructions: -0.3
  - Missing image: -0.1
  - Missing servings: -0.05
  - Few ingredients (< 3): -0.1

## Firestore Rules

### `/imports/{importId}`
- Read: User can read their own imports
- Create: Authenticated users can create imports
- Update: Only Cloud Functions (admin SDK)
- Delete: User can delete their own imports

### `/recipeDrafts/{draftId}`
- Read: User can read their own drafts
- Create: Only Cloud Functions
- Update: User can update their own drafts
- Delete: User can delete their own drafts

## Indexes

Required Firestore indexes:
- `/imports`: `userId` + `createdAt` (descending)
- `/imports`: `userId` + `status` + `createdAt` (descending)
- `/recipeDrafts`: `userId` + `createdAt` (descending)

## Usage Flow

1. **Client calls `startRecipeImport`**:
   ```typescript
   const result = await functions.httpsCallable('startRecipeImport')({
     url: 'https://example.com/recipe'
   });
   const { importId } = result.data;
   ```

2. **Client listens to import status**:
   ```typescript
   const unsubscribe = db
     .collection('imports')
     .doc(importId)
     .onSnapshot((snapshot) => {
       const importJob = snapshot.data() as ImportJob;
       if (importJob.status === 'ready') {
         // Navigate to preview with importJob.result.recipeDraftId
       } else if (importJob.status === 'failed') {
         // Show error
       }
     });
   ```

3. **Client loads recipe draft**:
   ```typescript
   const draft = await db
     .collection('recipeDrafts')
     .doc(draftId)
     .get();
   ```

4. **Client saves recipe** (converts draft to recipe):
   ```typescript
   const recipe = convertDraftToRecipe(draft.data());
   await db.collection('recipes').add(recipe);
   ```

## Testing

### Test URLs
- AllRecipes: `https://www.allrecipes.com/recipe/...`
- Food Network: `https://www.foodnetwork.com/recipes/...`
- Any site with JSON-LD Recipe schema

### Manual Testing
1. Call `startRecipeImport` with a recipe URL
2. Monitor Firestore `/imports/{importId}` document
3. Check `/recipeDrafts/{draftId}` when status is `ready`
4. Verify extracted data quality

## Future Enhancements (Phase 2)

1. **Microdata/RDFa parsing**
2. **Heuristic HTML parsing**
3. **Image re-hosting to Firebase Storage**
4. **HTML snapshot storage for debugging**
5. **Domain-specific retry policies**
6. **Caching by URL hash**
7. **Background queue with concurrency control**

## Configuration

Constants in `recipeImport.ts`:
- `MAX_CONTENT_SIZE`: 5 MB
- `FETCH_TIMEOUT`: 10 seconds
- `MAX_IMPORTS_PER_DAY`: 20

Adjust these based on your needs and Firebase quotas.
