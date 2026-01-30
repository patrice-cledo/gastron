# Backend Implementation Summary

This document summarizes the backend implementation for the Gastrons meal planning and grocery list app.

## Overview

The backend is built on Firebase (Firestore + Cloud Functions) following the specifications in `docs/design/001-mealplan-grocery.md`. It implements:

1. **Data Models**: All entities defined in the design doc (Recipe, MealPlan, GroceryList, etc.)
2. **Ingredient Normalization**: Parsing and canonicalization logic for deduplication
3. **Grocery List Engine**: Derives grocery lists from meal plans
4. **Cloud Functions**: Server-side computation for list recomputation
5. **Security Rules**: Firestore rules for data access control
6. **Offline-First**: Designed for Firestore's native offline persistence

## Key Features Implemented

### 1. Ingredient Normalization (`shared/ingredientNormalizer.ts`)

- **Canonical Key Generation**: Normalizes ingredient names for deduplication
  - Lowercase, strip punctuation
  - Basic pluralization handling
  - Removes common modifiers from key
  - Synonym mapping (scallion → green onion, etc.)

- **Parsing**: Extracts from raw text:
  - Quantity (handles fractions like "1 1/2")
  - Unit (normalized: tbsp → tablespoon, etc.)
  - Modifiers (chopped, diced, etc.)
  - Optional flag
  - Confidence score

### 2. Grocery List Engine (`shared/groceryListEngine.ts`)

- **Derivation Logic**: 
  - Aggregates ingredients from all meal plan entries
  - Applies serving multipliers
  - Merges compatible units
  - Handles incompatible units (keeps separate with conflict marker)

- **User Edit Preservation**:
  - Preserves checked state
  - Preserves pinned items
  - Preserves category overrides
  - Preserves user notes
  - Respects suppressed items

- **Auto-Categorization**: Simple keyword-based categorization

### 3. Cloud Functions (`functions/src/index.ts`)

#### `recomputeGroceryList`
- Recomputes grocery list from meal plan
- Fetches recipes, entries, overrides, categories
- Applies grocery list engine
- Saves to Firestore
- Returns list ID and version

#### `normalizeIngredient`
- Normalizes a single ingredient line
- Useful for testing and client-side normalization

#### `onMealPlanEntryChange` (Firestore Trigger)
- Triggers on meal plan entry changes
- Logs recomputation need (client handles actual recompute)

### 4. Security Rules (`firestore.rules`)

- User-level data isolation
- Read/write access only to owned documents
- Protection of system fields (version, computedAt)
- Prevents cross-user data access

### 5. Data Model (`shared/types.ts`)

All entities from design doc:
- `Recipe` with `IngredientLine[]`
- `MealPlan` with `MealPlanEntry[]`
- `GroceryList` with `GroceryItem[]`
- `UserOverrides` for custom mappings
- `Category` for ingredient organization

## Architecture Decisions

### Offline-First
- All writes are optimistic (client-side first)
- Firestore handles sync automatically
- Cloud Functions never block critical UX paths

### Derived Data Storage
- Grocery lists are stored (not computed on every read)
- Ensures fast rendering and offline availability
- Version field for conflict resolution

### Shared Modules
- Business logic (normalizer, engine) in pure TypeScript
- Can be imported by both client and server
- Reduces duplication and ensures consistency

## Setup Instructions

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login and Initialize**:
   ```bash
   firebase login
   firebase init
   ```

3. **Install Dependencies**:
   ```bash
   cd functions
   npm install
   ```

4. **Build Functions**:
   ```bash
   cd functions
   npm run build
   ```

5. **Initialize Default Categories** (optional):
   ```bash
   npm run init-categories
   ```

6. **Deploy**:
   ```bash
   firebase deploy
   ```

## Testing

### Local Development
```bash
firebase emulators:start
```

This starts:
- Firestore emulator (port 8080)
- Functions emulator (port 5001)
- Emulator UI (port 4000)

### Test Cloud Functions
Call functions via the emulator or deployed endpoints:
- `recomputeGroceryList({ dateRangeStart, dateRangeEnd, mealPlanId? })`
- `normalizeIngredient({ rawText })`

## Next Steps

1. **Client Integration**: 
   - Import shared types and modules into mobile app
   - Set up Firestore client SDK
   - Implement optimistic updates

2. **Enhanced Parsing**:
   - Consider NLP library for better ingredient parsing
   - Handle more edge cases (parenthetical notes, etc.)

3. **Testing**:
   - Unit tests for normalizer
   - Unit tests for grocery list engine
   - Integration tests for Cloud Functions
   - E2E tests for sync behavior

4. **Performance**:
   - Monitor Cloud Function cold starts
   - Optimize Firestore queries
   - Add caching where appropriate

5. **Features**:
   - Recipe import parsing (HTML → structured recipe)
   - Pantry-aware logic (don't add if already in pantry)
   - Store-specific pack sizes

## Notes

- All timestamps use ISO date strings (YYYY-MM-DD) for consistency
- Grocery list version increments on each recomputation
- User overrides take precedence over auto-categorization
- Pinned items are never removed, even if recipe is removed from plan
