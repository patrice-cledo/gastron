DESIGN DOC 003: Import Recipe by Pasting Text
1) Overview
Goal

Allow users to:

Paste raw recipe text (from anywhere)

Have the system intelligently parse it into a structured recipe

Review, edit, and confirm before saving

This flow is the fallback hero:

works when browser import fails

works with PDFs, newsletters, emails, paywalled sites

works with badly formatted content

works offline until parsing is triggered

Non-goals (v1)

OCR (handled by Camera flow)

Perfect parsing of every format

Detecting ingredients from emojis and vibes

2) Entry Points

Users can reach Paste Text Import from:

“Create Recipe” screen

Error fallback from Browser Import

Manual “Paste recipe” shortcut (optional)

3) User Experience
3.1 Paste Text Screen
UI layout

Header: “Paste recipe text”

Large multiline text input:

Placeholder example:

Ingredients:
- 2 cups flour
- 1 tsp salt

Instructions:
1. Mix dry ingredients
2. Bake at 350°F for 30 minutes


Optional fields:

Source (URL or note)

Language selector (optional v1.1)

Primary CTA: Parse recipe

Secondary CTA: “Clear”

UX notes

No character limit that users hit accidentally

Auto-focus on text input

Detect paste event and auto-scroll to bottom

Disable CTA until text length > minimal threshold (e.g. 200 chars)

3.2 Parsing Progress

When user taps Parse recipe:

Show loading state:

“Parsing recipe…”

Parsing is server-side (Cloud Function)

Allow cancel (returns to text input with content preserved)

3.3 Import Preview Screen

Same preview UI as Browser Import:

Title (editable)

Servings, time (if inferred)

Ingredients list (editable)

Instructions (editable)

Tags (optional)

Source field auto-filled as “Pasted text”

Warnings shown when applicable:

“Couldn’t confidently detect ingredient quantities”

“Instructions detected, but steps may need review”

Primary CTA: Save Recipe

4) Architecture
4.1 Mobile (React Native)

Text input screen

Submit raw text to backend

Listen for parsing job result (Firestore or direct callable response)

Navigate to preview screen

4.2 Backend (Firebase)

Cloud Function: parseRecipeFromText

Firestore:

Optional: store draft recipes

No external HTTP fetch required

Lower security risk than URL import

5) Data Model
5.1 Input payload
{
  "rawText": "Ingredients:\n2 cups flour...\nInstructions:\n1. Mix...",
  "source": "User pasted text",
  "language": "auto"
}

5.2 Draft Recipe (/recipeDrafts/{draftId})

Same structure as browser import drafts:

{
  "userId": "abc",
  "source": "paste",
  "rawTextHash": "sha256(...)",
  "title": "Untitled Recipe",
  "ingredients": [...],
  "instructions": [...],
  "confidence": 0.74,
  "warnings": ["Ambiguous quantities"],
  "createdAt": 1730000000
}

6) Parsing Strategy (Server-Side)

Parsing pasted text is pattern recognition + damage control.

Step 1: Preprocessing

Normalize line endings

Trim excessive whitespace

Remove obvious noise (ads, “subscribe”, etc.)

Preserve original text for debugging

Step 2: Section Detection

Detect common section headers:

Ingredients

Instructions / Directions / Method

Servings

Prep Time / Cook Time / Total Time

Fallback:

If no headers detected:

Use heuristics:

Lines starting with numbers → likely instructions

Bullet points → likely ingredients

Short lines with quantities → ingredients

Step 3: Ingredient Parsing

For each candidate ingredient line:

Preserve raw line

Attempt to extract:

quantity

unit

ingredient name

modifiers (chopped, divided, optional)

Assign confidence score per line

If parsing fails:

Keep raw line

Do not block save

Step 4: Instruction Parsing

Split by:

numbered lists

newlines + sentence boundaries

Normalize into ordered steps

Preserve original wording

Step 5: Title Inference

Use first non-empty line if it looks like a title

Else default to “Untitled Recipe”

User can always edit

Step 6: Confidence Scoring

Start at 1.0, subtract for:

Missing ingredient section

Missing instructions

Too few ingredients (<3)

Too few steps (<2)

Ambiguous parsing

Store warnings for preview UI.

7) Cloud Function API
Callable: parseRecipeFromText

Input:

{
  "rawText": "...",
  "source": "paste",
  "language": "auto"
}


Validation:

Authenticated user

Max text length (e.g. 20k chars)

Rate limit (especially free tier)

Output (option A – synchronous):

{
  "draftId": "draft_123"
}


Option B (if parsing gets heavy):

Async job + Firestore doc (same as browser import)

8) Offline Behavior

User can paste and edit text fully offline

Parsing requires network

If offline:

Disable “Parse recipe”

Show message:

“Connect to the internet to parse this recipe”

Text is preserved locally until parse succeeds

9) Error Handling
Possible failures

Text too short

Text too long

Parsing error

Rate limit exceeded

UX response

Clear error message

Text preserved

User can retry or manually create recipe

No data loss. Ever.

10) Security Considerations

Lower risk than URL import, but still:

Enforce size limits

Strip HTML/script tags defensively

Never execute content

Hash raw text to avoid duplicate processing abuse

11) Implementation Plan
Phase 1 (MVP)

Paste Text screen

Cloud Function parsing

Preview + save

Minimal heuristics

Phase 2

Better ingredient NLP

Language detection

User correction feedback loop

Save “last used format” improvements

12) Definition of Done

User can paste a messy recipe and get a usable draft

Nothing blocks saving even with low confidence

Errors never wipe user input

Preview always editable

Works as fallback from other import flows

13) Cursor Task Checklist

 PasteTextImportScreen

 Text persistence while navigating

 parseRecipeFromText Cloud Function

 Recipe draft storage

 Import Preview integration

 Save flow

 Rate limits + validation