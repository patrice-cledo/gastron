# Gastrons - Backend

Firebase backend implementation for the Gastrons meal planning and grocery list app.

## Architecture

- **Firestore**: Primary database for all data
- **Cloud Functions**: Server-side computation (grocery list recomputation, ingredient normalization)
- **Shared Modules**: TypeScript modules shared between client and server

## Project Structure

```
backend/
├── functions/          # Cloud Functions
│   ├── src/
│   │   └── index.ts   # Function definitions
│   ├── package.json
│   └── tsconfig.json
├── shared/             # Shared TypeScript modules
│   ├── types.ts        # Data model types
│   ├── ingredientNormalizer.ts  # Ingredient parsing & normalization
│   └── groceryListEngine.ts     # Grocery list derivation logic
├── firestore.rules     # Security rules
├── firestore.indexes.json  # Database indexes
├── firebase.json       # Firebase configuration
└── README.md
```

## Setup

1. Install dependencies (includes firebase-tools locally):
```bash
cd backend
npm install
```

2. Login to Firebase:
```bash
npm run firebase:login
# or: npm run firebase -- login
```

3. Initialize Firebase project (if not already done):
```bash
npm run firebase:init
# or: npm run firebase -- init
```

**Note**: All Firebase commands can be run via npm scripts:
- `npm run firebase:login` - Login to Firebase
- `npm run firebase:init` - Initialize Firebase project
- `npm run firebase:deploy` - Deploy to Firebase
- `npm run firebase:emulators` - Start emulators
- `npm run firebase -- <command>` - Run any Firebase command

4. Install dependencies:
```bash
cd functions
npm install
```

5. Build functions:
```bash
cd functions
npm run build
```

## Development

### Run Emulators

```bash
npm run firebase:emulators
# or: npm run firebase -- emulators:start
```

This will start:
- Firestore emulator on port 8080
- Functions emulator on port 5001
- Emulator UI on port 4000

### Deploy

Deploy all:
```bash
npm run firebase:deploy
# or: npm run firebase -- deploy
```

Deploy only functions:
```bash
npm run firebase -- deploy --only functions
```

Deploy only Firestore rules:
```bash
npm run firebase -- deploy --only firestore:rules
```

## Data Model

See `shared/types.ts` for complete type definitions.

### Collections

- `users/{userId}` - User profiles
- `recipes/{recipeId}` - Recipe data
- `mealPlans/{planId}` - Meal plans
- `mealPlanEntries/{entryId}` - Individual meal plan entries
- `groceryLists/{listId}` - Grocery lists
- `groceryItems/{itemId}` - Individual grocery items (if stored separately)
- `userOverrides/{userId}` - User-specific overrides (ingredient mappings, category overrides)
- `categories/{categoryId}` - Ingredient categories

## Cloud Functions

### `recomputeGroceryList`

Recomputes a grocery list from a meal plan.

**Parameters:**
- `dateRangeStart` (string, required): Start date (YYYY-MM-DD)
- `dateRangeEnd` (string, required): End date (YYYY-MM-DD)
- `mealPlanId` (string, optional): Specific meal plan ID

**Returns:**
- `success` (boolean)
- `listId` (string)
- `version` (number)

### `normalizeIngredient`

Normalizes a single ingredient line.

**Parameters:**
- `rawText` (string, required): Raw ingredient text

**Returns:**
- `parsed` (object): Parsed ingredient data
- `canonicalKey` (string): Canonical key for deduplication

## Security Rules

Firestore security rules enforce:
- User-level data isolation
- Read/write access only to owned documents
- Protection of system fields (version, computedAt, etc.)

See `firestore.rules` for complete rules.

## Shared Modules

### Ingredient Normalizer

Handles:
- Parsing raw ingredient text
- Generating canonical keys for deduplication
- Unit normalization
- Synonym mapping

### Grocery List Engine

Handles:
- Deriving grocery lists from meal plans
- Aggregating ingredients across recipes
- Preserving user edits (checked, pinned, category overrides)
- Deduplication and merging

## Testing

```bash
cd functions
npm test
```

## Notes

- All user-facing interactions should be optimistic (client-side first)
- Cloud Functions should never block critical UX paths
- Grocery lists are stored (not computed on every read) for performance
- Offline-first: Firestore handles sync automatically
