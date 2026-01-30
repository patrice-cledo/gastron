# API Reference

This document describes the Cloud Functions API and Firestore data access patterns.

## Cloud Functions

### `recomputeGroceryList`

Recomputes a grocery list from a meal plan.

**Endpoint**: `https://[region]-[project-id].cloudfunctions.net/recomputeGroceryList`

**Method**: Callable (HTTPS)

**Authentication**: Required

**Parameters**:
```typescript
{
  dateRangeStart: string;  // YYYY-MM-DD, required
  dateRangeEnd: string;     // YYYY-MM-DD, required
  mealPlanId?: string;      // Optional, if not provided, finds plan for date range
}
```

**Returns**:
```typescript
{
  success: boolean;
  listId: string;
  version: number;
}
```

**Example**:
```typescript
const result = await functions.httpsCallable('recomputeGroceryList')({
  dateRangeStart: '2024-01-01',
  dateRangeEnd: '2024-01-07',
  mealPlanId: 'plan123' // optional
});
```

**Errors**:
- `unauthenticated`: User not authenticated
- `invalid-argument`: Missing required parameters
- `not-found`: Meal plan not found
- `permission-denied`: Not authorized to access meal plan
- `internal`: Server error

---

### `normalizeIngredient`

Normalizes a single ingredient line.

**Endpoint**: `https://[region]-[project-id].cloudfunctions.net/normalizeIngredient`

**Method**: Callable (HTTPS)

**Authentication**: Optional (but recommended)

**Parameters**:
```typescript
{
  rawText: string;  // Required, raw ingredient text
}
```

**Returns**:
```typescript
{
  parsed: {
    name: string;
    quantity: number | null;
    unit: string | null;
    modifiers: string[];
    optional: boolean;
    confidence: number;  // 0..1
  };
  canonicalKey: string;
}
```

**Example**:
```typescript
const result = await functions.httpsCallable('normalizeIngredient')({
  rawText: '2 cups chopped onions'
});
// Returns:
// {
//   parsed: {
//     name: 'onion',
//     quantity: 2,
//     unit: 'cup',
//     modifiers: ['chopped'],
//     optional: false,
//     confidence: 0.8
//   },
//   canonicalKey: 'onion'
// }
```

---

### `getUserCollections`

Gets the user's recipe collections (cookbooks).

**Endpoint**: `https://[region]-[project-id].cloudfunctions.net/getUserCollections`

**Method**: Callable (HTTPS)

**Authentication**: Required

**Parameters**: None

**Returns**:
```typescript
{
  collections: string[];  // Array of collection names, including defaults
}
```

**Example**:
```typescript
const result = await functions.httpsCallable('getUserCollections')();
// Returns:
// {
//   collections: ['Favorites', 'Want to cook', 'My Custom Collection']
// }
```

**Default Collections**:
- `'Favorites'` - Always included
- `'Want to cook'` - Always included

**Errors**:
- `unauthenticated`: User not authenticated
- `internal`: Server error

**Note**: If the user document doesn't exist, it will be created automatically with empty collections.

---

## Firestore Collections

### Users

**Path**: `/users/{userId}`

**Fields**:
- `userId` (string)
- `email` (string, optional)
- `displayName` (string, optional)
- `collections` (string[], optional) - User-created collection names (excludes defaults)
- `createdAt` (timestamp, optional)

**Access**: User can read/write their own document

**Note**: The `collections` field stores only user-created collections. Default collections ('Favorites', 'Want to cook') are always included and should be merged client-side or via the `getUserCollections` function.

---

### Recipes

**Path**: `/recipes/{recipeId}`

**Fields**:
- `id` (string)
- `title` (string)
- `servingsDefault` (number)
- `ingredients` (IngredientLine[])
- `instructions` (string)
- `tags` (string[], optional)
- `userId` (string, optional) - null for public recipes
- `createdAt` (timestamp, optional)
- `updatedAt` (timestamp, optional)

**Access**: 
- Read: Own recipes or public recipes (userId == null)
- Write: Own recipes only

**Queries**:
```typescript
// Get user's recipes
db.collection('recipes')
  .where('userId', '==', userId)
  .orderBy('createdAt', 'desc')
  .get();

// Get public recipes
db.collection('recipes')
  .where('userId', '==', null)
  .get();
```

---

### Meal Plans

**Path**: `/mealPlans/{planId}`

**Fields**:
- `id` (string)
- `userId` (string)
- `startDate` (string) - YYYY-MM-DD
- `entries` (MealPlanEntry[]) - stored in separate collection
- `createdAt` (timestamp, optional)
- `updatedAt` (timestamp, optional)
- `version` (number, optional) - for sync

**Access**: User can read/write their own meal plans

**Queries**:
```typescript
// Get meal plan for date range
db.collection('mealPlans')
  .where('userId', '==', userId)
  .where('startDate', '>=', startDate)
  .where('startDate', '<=', endDate)
  .limit(1)
  .get();
```

---

### Meal Plan Entries

**Path**: `/mealPlanEntries/{entryId}`

**Fields**:
- `id` (string)
- `planId` (string)
- `date` (string) - YYYY-MM-DD
- `mealType` (string) - 'breakfast' | 'lunch' | 'dinner' | 'snack'
- `recipeId` (string)
- `servingsOverride` (number | null)
- `includeInGrocery` (boolean)
- `notes` (string, optional)
- `batchCook` (boolean, optional)

**Access**: User can read/write entries for their own meal plans

**Queries**:
```typescript
// Get entries for a meal plan
db.collection('mealPlanEntries')
  .where('planId', '==', planId)
  .where('date', '>=', startDate)
  .where('date', '<=', endDate)
  .get();

// Get entries for a specific date
db.collection('mealPlanEntries')
  .where('planId', '==', planId)
  .where('date', '==', date)
  .get();
```

---

### Grocery Lists

**Path**: `/groceryLists/{listId}`

**Fields**:
- `id` (string)
- `userId` (string)
- `scope` (object):
  - `dateRangeStart` (string) - YYYY-MM-DD
  - `dateRangeEnd` (string) - YYYY-MM-DD
- `items` (GroceryItem[])
- `version` (number) - increments on recomputation
- `computedAt` (timestamp, optional)
- `updatedAt` (timestamp, optional)

**Access**: User can read/write their own grocery lists

**Queries**:
```typescript
// Get grocery list for date range
db.collection('groceryLists')
  .where('userId', '==', userId)
  .where('scope.dateRangeStart', '==', startDate)
  .where('scope.dateRangeEnd', '==', endDate)
  .limit(1)
  .get();
```

**Note**: System fields (`computedAt`, `version`) are protected from client writes.

---

### Grocery Items

**Path**: `/groceryItems/{itemId}` (if stored separately)

**Fields**:
- `id` (string)
- `canonicalKey` (string) - dedupe key
- `displayName` (string)
- `quantity` (number | null)
- `unit` (string | null)
- `categoryId` (string)
- `checked` (boolean)
- `pinned` (boolean)
- `notes` (string | null)
- `sources` (GrocerySource[])
- `suppressed` (boolean, optional)

**Note**: Items are typically stored as sub-collection or array within `groceryLists`.

---

### User Overrides

**Path**: `/userOverrides/{userId}`

**Fields**:
- `userId` (string)
- `ingredientCanonicalMap` (object) - rawName -> canonicalKey
- `categoryMap` (object) - canonicalKey -> categoryId
- `updatedAt` (timestamp, optional)

**Access**: User can read/write their own overrides

**Example**:
```typescript
// Get user overrides
const overrides = await db
  .collection('userOverrides')
  .doc(userId)
  .get();

// Update category override
await db
  .collection('userOverrides')
  .doc(userId)
  .set({
    categoryMap: {
      'onion': 'custom-category-id'
    }
  }, { merge: true });
```

---

### Categories

**Path**: `/categories/{categoryId}`

**Fields**:
- `id` (string)
- `name` (string)
- `sortOrder` (number)
- `userCustom` (boolean)
- `userId` (string, optional) - for custom categories

**Access**: 
- Read: All authenticated users
- Write: Only custom categories (userCustom == true)

**Queries**:
```typescript
// Get all categories, ordered by sortOrder
db.collection('categories')
  .orderBy('sortOrder')
  .get();

// Get default categories
db.collection('categories')
  .where('userCustom', '==', false)
  .orderBy('sortOrder')
  .get();

// Get user's custom categories
db.collection('categories')
  .where('userCustom', '==', true)
  .where('userId', '==', userId)
  .get();
```

---

## Client Usage Patterns

### Optimistic Updates

All writes should be optimistic:

```typescript
// 1. Update local state immediately
const newEntry = { ...entry, checked: true };
setLocalState(newEntry);

// 2. Write to Firestore (will sync automatically)
await db.collection('groceryLists').doc(listId).update({
  'items.0.checked': true
});

// 3. If needed, trigger recomputation (non-blocking)
functions.httpsCallable('recomputeGroceryList')({
  dateRangeStart,
  dateRangeEnd
}).catch(err => {
  // Handle error, but don't block UI
  console.error('Recompute failed:', err);
});
```

### Offline Support

Firestore handles offline automatically:
- Writes are queued locally
- Sync happens when network is available
- No manual sync needed

### Real-time Listeners

Use selectively for active data:

```typescript
// Listen to grocery list changes
const unsubscribe = db
  .collection('groceryLists')
  .doc(listId)
  .onSnapshot((snapshot) => {
    const list = snapshot.data();
    updateUI(list);
  });

// Don't forget to unsubscribe
unsubscribe();
```

---

## Error Handling

All Cloud Functions return standard Firebase errors:
- `unauthenticated`: User not logged in
- `permission-denied`: Not authorized
- `invalid-argument`: Bad parameters
- `not-found`: Resource doesn't exist
- `internal`: Server error

Handle errors gracefully and provide user feedback.
