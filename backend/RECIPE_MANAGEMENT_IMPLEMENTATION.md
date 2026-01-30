# Recipe Management Backend Implementation

## Overview

This document describes the backend implementation for user-created recipes, including support for private/public recipes, equipment, and photo uploads.

## Architecture

### Data Model

There are two Recipe types in the system:

1. **`Recipe`** (for meal planning):
   - Uses `IngredientLine[]` with parsed data
   - Used by grocery list engine
   - Has `servingsDefault` field
   - Used for recipes imported/parsed from external sources

2. **`UserRecipe`** (for user-created recipes):
   - Uses `RecipeIngredient[]` (simpler format)
   - Stored in Firestore `recipes` collection
   - Has `isPublic` field (private by default)
   - Supports equipment, photos, nutrition, etc.

### Cloud Functions

1. **`createRecipe`**: Creates a new user recipe (private by default)
2. **`updateRecipe`**: Updates an existing recipe (including public/private toggle)

## API Functions

### `createRecipe`

**Input:**
```typescript
{
  title: string;
  description?: string;
  notes?: string; // Additional notes about the recipe
  chefTips?: string[]; // Array of chef tips/hints
  image?: string; // URL (already uploaded to Storage)
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  equipment?: RecipeEquipment[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  nutrition?: RecipeNutrition;
  tags?: string[]; // Tags for categorization/search
  cuisine?: string;
  sourceUrls?: string[];
  isPublic?: boolean; // Optional, defaults to false (private)
}
```

**Output:**
```typescript
{
  recipeId: string;
  recipe: UserRecipe;
}
```

**Validation:**
- Title is required
- At least one ingredient required
- At least one step required
- Image URL must be valid http/https
- Source URLs must be valid http/https
- Times and servings must be non-negative/positive
- Nutrition values must be non-negative

**Behavior:**
- Recipes are **private by default** (`isPublic: false`)
- Sets `userId` from authenticated user
- Automatically sorts steps by `order`
- Creates timestamps (`createdAt`, `updatedAt`)

### `updateRecipe`

**Input:**
```typescript
{
  recipeId: string;
  // All other fields optional (same as createRecipe)
  notes?: string;
  chefTips?: string[];
  tags?: string[];
  isPublic?: boolean; // Can toggle public/private
  // ... other fields
}
```

**Output:**
```typescript
{
  recipeId: string;
  recipe: UserRecipe;
}
```

**Validation:**
- Recipe must exist
- User must own the recipe
- Same validation rules as createRecipe for updated fields
- Cannot change `userId`

**Behavior:**
- Only updates provided fields (partial update)
- Updates `updatedAt` timestamp
- Can toggle `isPublic` to make recipe public/private

## Data Model Details

### UserRecipe

```typescript
{
  id: string;
  title: string;
  description?: string;
  notes?: string; // Additional notes about the recipe
  chefTips?: string[]; // Array of chef tips/hints
  image?: string; // Firebase Storage URL
  ingredients: RecipeIngredient[]; // { id, name, amount, unit? }
  steps: RecipeStep[]; // { id, order, description, image?, duration? }
  equipment?: RecipeEquipment[]; // { id, name, description? }
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  servings?: number;
  nutrition?: RecipeNutrition; // { calories, protein, carbs, fats }
  tags?: string[]; // Tags for categorization/search
  cuisine?: string;
  sourceUrls?: string[];
  userId: string; // Required
  isPublic: boolean; // false = private, true = public
  createdAt: number; // timestamp
  updatedAt: number; // timestamp
}
```

## Firestore Rules

```javascript
match /recipes/{recipeId} {
  // Users can read:
  // - Their own recipes (public or private)
  // - Public recipes (isPublic == true)
  allow read: if isAuthenticated() && (
    resource.data.userId == request.auth.uid ||
    (resource.data.isPublic == true && resource.data.hasOwnProperty('isPublic'))
  );
  
  // Users can create recipes (must set userId and isPublic)
  allow create: if isAuthenticated() && 
    request.resource.data.userId == request.auth.uid &&
    request.resource.data.hasOwnProperty('isPublic');
  
  // Users can update/delete their own recipes
  allow update: if isOwner(resource.data.userId) &&
    request.resource.data.userId == resource.data.userId; // Prevent changing userId
  
  allow delete: if isOwner(resource.data.userId);
}
```

## Firestore Indexes

Required indexes (already added to `firestore.indexes.json`):

1. `recipes` collection:
   - `userId` (ASC) + `createdAt` (DESC) - for user's recipes
   - `isPublic` (ASC) + `createdAt` (DESC) - for public recipes
   - `isPublic` (ASC) + `tags` (CONTAINS) + `createdAt` (DESC) - for public recipe search

## Image Upload

Images are handled client-side via Firebase Storage:

1. Client uploads image to Storage: `recipes/{recipeId}/{timestamp}.jpg`
2. Client gets download URL from Storage
3. Client calls `createRecipe` or `updateRecipe` with image URL
4. Backend validates URL format (http/https)

**Note**: For production, you may want to add a Cloud Function to:
- Generate signed upload URLs
- Validate image size/format
- Process/resize images

## Equipment Support

Equipment is stored as an array of `RecipeEquipment` objects:

```typescript
{
  id: string;
  name: string;
  description?: string;
}
```

Equipment is optional - recipes can be created without it.

## Public/Private Recipes

- **Private (default)**: `isPublic: false`
  - Only the recipe owner can read it
  - Used for personal recipes

- **Public**: `isPublic: true`
  - All authenticated users can read it
  - Can be discovered/shared
  - Owner can toggle back to private anytime

## Usage Example

### Create a Private Recipe

```typescript
const result = await createRecipe({
  title: "My Secret Recipe",
  ingredients: [
    { id: "1", name: "Flour", amount: "2", unit: "cups" }
  ],
  steps: [
    { id: "1", order: 1, description: "Mix ingredients" }
  ],
  // isPublic defaults to false
});
```

### Make Recipe Public

```typescript
await updateRecipe({
  recipeId: "recipe123",
  isPublic: true
});
```

### Add Equipment

```typescript
await updateRecipe({
  recipeId: "recipe123",
  equipment: [
    { id: "1", name: "Stand Mixer" },
    { id: "2", name: "Baking Sheet", description: "Large size" }
  ]
});
```

### Add Notes and Chef Tips

```typescript
await updateRecipe({
  recipeId: "recipe123",
  notes: "This recipe works best when made the day before serving.",
  chefTips: [
    "Let the dough rest for at least 30 minutes",
    "Use room temperature butter for best results",
    "Don't overmix or the texture will be tough"
  ]
});
```

### Add Tags

```typescript
await updateRecipe({
  recipeId: "recipe123",
  tags: ["dessert", "chocolate", "easy", "quick"]
});
```

## Testing

### Development

1. Start emulators:
   ```bash
   npm run firebase:emulators
   ```

2. Call `createRecipe`:
   ```bash
   curl -X POST http://localhost:5001/cookthispage/us-central1/createRecipe \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "data": {
         "title": "Test Recipe",
         "ingredients": [{"id": "1", "name": "Flour", "amount": "2", "unit": "cups"}],
         "steps": [{"id": "1", "order": 1, "description": "Mix"}]
       }
     }'
   ```

3. Call `updateRecipe`:
   ```bash
   curl -X POST http://localhost:5001/cookthispage/us-central1/updateRecipe \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "data": {
         "recipeId": "...",
         "isPublic": true
       }
     }'
   ```

## Security

1. **Authentication Required**: All recipe operations require authentication
2. **Ownership Verification**: Users can only update/delete their own recipes
3. **Public Read Access**: Public recipes are readable by all authenticated users
4. **URL Validation**: Image and source URLs are validated (http/https only)
5. **Input Validation**: All fields are validated for type and format

## Next Steps

1. **Frontend Integration**: Update frontend to use these Cloud Functions instead of direct Firestore writes
2. **Image Processing**: Add Cloud Function for image resizing/optimization
3. **Recipe Search**: Add search function for public recipes
4. **Recipe Sharing**: Add sharing functionality (generate share links)
5. **Recipe Conversion**: Add function to convert UserRecipe to Recipe format for meal planning
