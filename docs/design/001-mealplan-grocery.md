Design Doc 001: Seamless Meal Planning + Grocery List Integration
0) Goal

Build a meal planning system where:

users plan meals (calendar or list),

the grocery list updates automatically,

ingredients dedupe intelligently,

users can edit/override items and categories,

list can be shared/exported,

and everything works offline with sync.

Success metric: user can plan a week and shop in 60 seconds without fighting duplicates, missing items, or re-sync buttons.

1) Core UX (Screens + Flows)
A) Meal Plan Screen (Week view)

Week calendar with meal slots (Breakfast / Lunch / Dinner / Snacks optional)

Add recipe to slot

Change servings for a slot

Toggle “include in grocery list” per slot (default ON)

Optional: “Batch cook” marker (makes list group differently later)

User actions

Add recipe → immediate grocery list update

Remove recipe → grocery list update (unless user manually pinned items)

Edit servings → grocery list quantities update

B) Grocery List Screen

Aisle/category grouped view (Produce, Dairy, Meat, Pantry, Spices, Frozen, etc.)

Each item has:

checkbox (purchased)

quantity + unit

item name (normalized)

notes (optional, e.g., “divided”)

source breakdown (tap to see which recipes contributed)

category override (move to another category)

“pinned/manual” tag (prevents deletion when plan changes)

Top actions

“Shop for: This week / custom date range” (see detailed behavior below)

“Share list” (link, text, or export)

“Merge suggestions” (optional prompt when weird duplicates exist)

B.1) “Shop for: This week / Custom date range” - Detailed Behavior

What it actually means (and why users care)

This control answers one very human question:

“What am I buying right now, not what exists in my entire life?”

Instead of one ever-growing grocery list, the app generates a scoped list based on time, not chaos.

1) Mental model (the part users instantly get)

Users don't think in “all planned meals ever.”
They think in:

“This week”

“Next 3 days”

“Saturday prep day”

“Just dinners, not lunches”

So this selector defines which meal plan entries are included when generating the grocery list.

No magic. No guessing. Just scope.

2) UX behavior

Default state

Shop for: This week

Automatically selects:

current week (based on locale week start)

all meal plan entries with includeInGrocery = true

This is the 90% case.

Zero setup required.

When user taps it

A bottom sheet or modal opens with:

Option A: This week (quick action)

Today → end of current week

Shows subtitle:

“Mon Sep 9 – Sun Sep 15”

One tap, instant refresh of grocery list.

Option B: Custom date range

User selects:

Start date

End date

Live preview text:

“Shopping for meals from Tue Sep 10 → Fri Sep 13 (6 meals)”

Confirm → grocery list updates immediately.

3) What changes under the hood (important)

The grocery list is not just filtered visually.
It is recomputed based on the selected range.

Included:

MealPlanEntries where:

entry.date ∈ selected range

includeInGrocery = true

Excluded:

Meals outside the range

Meals marked “don't include in grocery list”

Manual grocery items only excluded if user explicitly unchecks or removes them

Preserved:

Checked state (if item still exists)

Manual edits (notes, renamed items)

Pinned items (even if outside range, depending on design choice)

4) Example scenarios (this is where it shines)

Scenario 1: Weekly shopper

User plans the whole week.

Leaves selector on This week

Grocery list is complete, boring, perfect.

Scenario 2: Midweek restock

User already shopped Sunday.
On Wednesday they:

Switch to Custom range

Select Wed → Fri

Grocery list instantly shrinks to:

missing ingredients only for remaining meals

No mental subtraction. No crossed-out junk.

Scenario 3: Meal prep day

User batch-cooks for:

Mon–Thu lunches

Sat–Sun dinners

They:

Create two grocery runs

Use date ranges to generate two scoped lists

Optionally save them as presets later (v2 feature)

5) Edge behavior (where apps usually mess this up)

Checked items

If user switches range:

Items that still exist → stay checked

Items no longer in scope:

Either disappear

Or collapse into a “Not in this range” section (advanced, optional)

Manual items

Manual grocery items:

Default behavior: always included

Unless user toggles “scope-aware manual items” (advanced setting)

This avoids the classic “why did my milk disappear?” rage.

6) Data implications (brief but real)

Grocery list has:

scopeStartDate

scopeEndDate

Changing the scope:

Triggers recompute (locally first)

Preserves user overrides

Stores the scope so reopening the app shows the same list

No “generate” button.
No destructive reset.
No surprises.

7) Why this is a differentiator (quietly)

Most apps:

Either show everything

Or force weekly-only thinking

Or make you regenerate and lose edits

This feature:

Matches how people actually shop

Supports partial weeks, leftovers, real life

Makes the app feel like it's paying attention

Users won't describe it.
They'll just say:

“This one feels easier.”

Which is the highest compliment humans accidentally give software.

C) “Confirm Merge” Modal (only when needed)

When ingredient parsing is ambiguous (e.g., “1 red onion” + “2 onions”), show a smart merge suggestion:

Merge into “Onion” qty 3? (Yes/No)
We keep this minimal because nobody wants to do data cleanup while hungry.

2) Data Model (Backend + Local)
Entities
Recipe

id

title

servings_default

ingredients: list of IngredientLine

instructions

tags, etc.

IngredientLine (raw)

id

rawText: string (original)

parsed:

name: string (canonical candidate)

quantity: number | null

unit: string | null

modifiers: string[] (diced, chopped)

optional: boolean

confidence: 0..1

MealPlan

id

userId

startDate (week start)

entries: list of MealPlanEntry

MealPlanEntry

id

planId

date

mealType (breakfast/lunch/dinner/snack)

recipeId

servingsOverride (number | null)

includeInGrocery (bool)

notes (optional)

GroceryList

id

userId

scope:

dateRangeStart

dateRangeEnd

items: list of GroceryItem

version (for sync)

GroceryItem

id

canonicalKey (string) // the dedupe key

displayName (string)

quantity (number | null)

unit (string | null)

categoryId

checked (bool)

pinned (bool) // manual or locked

notes (string | null)

sources: list of GrocerySource

GrocerySource

recipeId

mealPlanEntryId

ingredientLineId

amount (qty/unit normalized as possible)

Category

id

name

sortOrder

userCustom (bool)

UserOverrides (optional but recommended)

To prevent “planner changes nuked my edits”:

ingredient canonical override map (rawName -> canonicalKey)

category override map (canonicalKey -> categoryId)

3) The tricky part: Ingredient normalization + dedupe
Canonical Key Rules (v1)

Goal: dedupe without becoming a PhD thesis.

lower-case

strip punctuation

singularize basic plurals (onions -> onion)

remove common modifiers (fresh, chopped, diced) from canonical key, keep in notes/modifiers

normalize synonyms via dictionary:

scallion -> green onion

cilantro -> coriander (optional based on locale)

bell pepper -> capsicum (optional)

unit normalization (best effort):

tbsp/tablespoon

tsp/teaspoon

g/kg, oz/lb

count-based items keep unit = “each” when appropriate

Dedupe behavior

Same canonicalKey:

If both have numeric qty + compatible units → sum

If incompatible units (e.g., “1 can tomatoes” + “400g tomatoes”) → keep separate lines but grouped under same key with “variants”

If one missing qty → keep both, but show warning icon “qty unclear”

When to ask user

Only when confidence is low AND it causes a likely duplicate:

“red onion” vs “onion”

“garlic clove” vs “garlic”
This triggers merge suggestions.

v2 (later)

Add pantry-aware logic (don’t add if already in pantry)

Add store-specific pack sizes (buy 1 pack of chicken thighs)

4) Sync / Offline-first behavior (must not suck)
Local storage

SQLite (recommended) via expo-sqlite or react-native-sqlite-storage

Store:

meal plan entries

grocery list items

overrides

checked state

Sync strategy (simple and robust)

Treat GroceryList as derived data from meal plan + overrides, but persist it because users check items off.

On device:

whenever meal plan changes → recompute grocery list “desired state”

merge with existing list preserving:

checked state

pinned/manual items

category overrides

user edits to text/notes if pinned or edited flag set

Conflict handling (multi-device)

Use version and updatedAt.

Server stores:

last computed list + user edits

Client pushes:

diff of user actions (checked toggles, moved category, pin/unpin, manual add/remove)

Meal plan edits sync separately.

On sync, server recomputes list and re-applies user actions deterministically.

Yes, determinism matters. Otherwise you get “my list changed by itself” and users uninstall.

5) Backend APIs
Meal Plan

GET /meal-plans?start=YYYY-MM-DD&end=YYYY-MM-DD

POST /meal-plans/entries { date, mealType, recipeId, servingsOverride, includeInGrocery }

PATCH /meal-plans/entries/:id

DELETE /meal-plans/entries/:id

Grocery List

POST /grocery-lists/recompute { startDate, endDate }
Returns computed list (server-side canonicalization)

GET /grocery-lists?start=...&end=...

PATCH /grocery-lists/items/:id (checked, categoryId, notes, pinned)

POST /grocery-lists/items (manual add)

DELETE /grocery-lists/items/:id (manual remove or unpin removal)

Overrides

GET /overrides

PATCH /overrides { canonicalMap?, categoryMap? }

6) Implementation Plan (React Native)
Modules

MealPlanScreen

GroceryListScreen

IngredientNormalizer (shared library, ideally also on backend)

GroceryListEngine (derivation logic client-side for instant UX, but backend remains source of truth)

SyncService (push/pull, queue offline mutations)

State management

If you’re already using Redux or Zustand, great.

Store:

plan entries

grocery list

pending mutations queue

Instant update pattern

User adds recipe to plan

Update local plan

Locally recompute grocery list quickly (optimistic)

Queue backend recompute/sync

Backend response reconciles (rare differences)

7) Edge Cases

Same ingredient different forms:

“1 onion” + “1 onion, diced”: merge qty, keep modifier in notes

Ambiguous ingredients:

“salt to taste” → keep as item with null qty, category “Pantry”

Multi-unit entries:

“1 (14 oz) can tomatoes”: store qty=1 unit=can; keep weight in notes

User manually deletes an auto item:

Mark as “suppressed” for that scope so it doesn’t reappear unless reset

Changing servings after checking items:

Preserve checked state if item remains; if qty increases, keep checked but show “quantity changed” badge

8) Testing

Unit tests for normalizer + dedupe rules

Snapshot tests for grocery list grouping

Sync tests for conflict resolution (multi-device)

E2E: add plan → list updates; remove plan → list updates; manual pin survives

9) Definition of Done

No “Generate list” button exists.

Adding/removing/changing servings reflects in grocery list within 200ms locally.

Duplicates merge correctly 90%+ of time.

Manual changes do not get stomped.

Works offline and syncs later.

Backend Infrastructure Clause: Firebase Usage
Backend Platform

The backend will be implemented using Firebase, with Firestore as the primary database and Cloud Functions for server-side computation.

Firebase is selected to optimize for:

offline-first mobile UX

real-time synchronization

fast iteration without custom sync infrastructure

reduced backend surface area for MVP

This decision prioritizes shipping velocity and reliability over long-term portability. Re-evaluation may occur post-PMF.

Core Firebase Components
1. Firestore (Primary Data Store)

Firestore will serve as the source of truth for:

Users

Recipes

Meal plans

Grocery lists

User overrides (ingredient normalization, category overrides)

Sync metadata (versions, timestamps)

Key characteristics

Client-side offline persistence enabled

Optimistic writes supported

Real-time listeners used selectively (not globally)

Data access rules

Reads optimized for:

“current week meal plan”

“active grocery list”

Writes are:

atomic at document level

idempotent where possible

Firestore collections (high level):

/users/{userId}

/recipes/{recipeId}

/mealPlans/{planId}

/mealPlanEntries/{entryId}

/groceryLists/{listId}

/groceryItems/{itemId}

/userOverrides/{userId}

2. Cloud Functions (Server-Side Logic)

Cloud Functions are used for:

Recipe import parsing (HTML → structured recipe)

Grocery list recomputation (authoritative merge)

Ingredient canonicalization (shared logic with client)

Conflict resolution on sync

Heavy AI or parsing workloads

Trigger types

HTTPS callable functions for explicit actions (import recipe, recompute list)

Firestore triggers only for:

consistency enforcement

cleanup tasks

background recomputation (never blocking UX)

Design rule

No critical UX path may depend on a cold Cloud Function response.

All user-facing interactions must be optimistic and locally resolved first.

3. Offline-First Strategy (Firestore Native)

Firestore’s offline persistence is relied upon for:

Meal plan edits

Grocery list checkbox toggles

Category overrides

Manual grocery item additions

Behavior

All writes are committed locally first

Sync occurs automatically when network is available

UI must assume writes succeed unless explicitly rejected by security rules

Conflict resolution

Last-write-wins at field level

User intent preserved via:

pinned items

manual overrides

suppressed auto-items

Cloud Functions reconcile derived data without overwriting explicit user edits.

4. Security Rules

Firestore security rules enforce:

User-level data isolation

Read/write access only to owned documents

No cross-user data access

No server-only fields writable from client

Rules must explicitly protect:

Derived fields (e.g., canonical keys)

System metadata (version, computedAt)

AI-generated fields (confidence scores)

5. Data Modeling Constraints

Because Firestore is NoSQL:

Avoid deep nesting beyond 1 level

Prefer flat collections with references

Avoid fan-out writes in client code

Aggregate data (e.g., grocery list) stored denormalized for read speed

Derived data (like grocery lists) is stored, not computed on every read, to guarantee:

fast rendering

offline availability

predictable UX

6. Vendor Lock-In Acknowledgement

This architecture accepts Firebase lock-in for the MVP phase.

Mitigations:

Shared domain logic (ingredient normalization, list derivation) lives in pure TS modules

Cloud Functions do not contain business rules that cannot be ported

Export paths (JSON/CSV) supported for user data ownership

Migration to a SQL-based backend (e.g., Supabase) remains feasible if required post-scale.

Definition of Done (Firebase Layer)

App functions fully offline for meal planning and grocery shopping

No blocking network calls on core user flows

Firestore rules fully locked down before public release

Cold-start latency never blocks UI

Grocery list remains stable across devices and sessions